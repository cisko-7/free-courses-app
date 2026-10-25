import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AttemptLimiter,
  computeXp,
  createCooldown,
  dedupeIds,
  isAdminSession,
  sanitizeCodeMap,
  sanitizeSearchQuery,
  sanitizeText,
  sanitizeUrl,
  LIMITS
} from '../lib/security.ts';

test('sanitizeText убирает управляющие и bidi-символы, схлопывает пробелы', () => {
  assert.equal(sanitizeText('  Иван\u0000  \u202eПетров\t ', 60), 'Иван Петров');
  assert.equal(sanitizeText(42, 60), '');
});

test('sanitizeText не режет эмодзи пополам', () => {
  assert.equal(sanitizeText('🚀🚀🚀', 2), '🚀🚀');
});

test('sanitizeText в многострочном режиме сохраняет переводы строк', () => {
  assert.equal(sanitizeText('a\r\n\r\n\r\n\r\nb', 100, { multiline: true }), 'a\n\nb');
});

test('sanitizeUrl пропускает только http(s)', () => {
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('data:text/html,hi'), '');
  assert.equal(sanitizeUrl('https://user:pass@example.com'), '');
  assert.equal(sanitizeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(sanitizeUrl('https://evil.com', ['https://example.com']), '');
});

test('sanitizeSearchQuery вырезает спецсимволы фильтра PostgREST', () => {
  assert.equal(sanitizeSearchQuery('a,b(c)*%\\d'), 'abcd');
  assert.equal(sanitizeSearchQuery('ivan.petrov+1@mail.ru'), 'ivan.petrov+1@mail.ru');
});

test('dedupeIds удаляет дубликаты и мусор, сохраняя порядок', () => {
  assert.deepEqual(dedupeIds(['b', 'a', 'b', '', 7, '<x>', ' a ']), ['b', 'a']);
  assert.deepEqual(dedupeIds('not-array'), []);
});

test('computeXp считает только уникальные шаги', () => {
  assert.equal(computeXp(['a', 'a', 'b']), 100);
  assert.equal(computeXp(['a'], 25), 75);
  assert.equal(computeXp([], -10), 0);
});

test('sanitizeCodeMap режет код и отбрасывает небезопасные ключи', () => {
  const map = sanitizeCodeMap({ ok: 'x'.repeat(LIMITS.code + 5), 'bad key': 'y', num: 5 });
  assert.deepEqual(Object.keys(map), ['ok']);
  assert.equal(map.ok.length, LIMITS.code);
});

test('createCooldown отсчитывает интервал', () => {
  let now = 1000;
  const cd = createCooldown(60_000, () => now);
  assert.equal(cd.isReady(), true);
  cd.trigger();
  assert.equal(cd.isReady(), false);
  now += 59_999;
  assert.equal(cd.remainingMs(), 1);
  now += 1;
  assert.equal(cd.isReady(), true);
});

test('AttemptLimiter блокирует после лимита и восстанавливается из sessionStorage', () => {
  let now = 0;
  const limiter = new AttemptLimiter(3, 10_000, () => now);
  for (let i = 0; i < 3; i++) limiter.record();
  const blocked = limiter.check();
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 10);

  const restored = new AttemptLimiter(3, 10_000, () => now);
  restored.restore(limiter.serialize());
  assert.equal(restored.check().allowed, false);

  now = 10_000;
  assert.equal(restored.check().allowed, true);
  restored.restore('{broken');
  assert.equal(restored.check().allowed, true);
});

test('isAdminSession доверяет только app_metadata живой сессии', () => {
  const now = () => 1_000_000;
  assert.equal(isAdminSession({ expires_at: 2000, user: { app_metadata: { role: 'admin' } } }, now), true);
  assert.equal(isAdminSession({ expires_at: 999, user: { app_metadata: { role: 'admin' } } }, now), false);
  assert.equal(isAdminSession({ user: { app_metadata: { role: 'student' } } }, now), false);
  assert.equal(isAdminSession(null, now), false);
});
