import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_SYNC_KEY,
  classifySyncError,
  flushPendingSync,
  mergeLocalIntoCloud,
  parseCloudRow,
  queuePendingSync,
  readPendingSync,
  saveProfile,
  type KeyValueStorage,
  type ProfileData
} from '../lib/supabase-sync.ts';

// --- Заглушки ---

type Result = { data?: unknown; error: { code?: string; message: string } | null };

/** Мини-имитация query builder Supabase: каждый вызов from() берёт следующий ответ из очереди. */
function fakeClient(responses: Result[]) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      const response = responses.shift() ?? { data: null, error: { message: 'no more responses' } };
      const builder: Record<string, unknown> = {};
      const chain = (name: string) => () => {
        calls.push(`${table}.${name}`);
        return builder;
      };
      for (const m of ['update', 'eq', 'select', 'limit', 'maybeSingle']) builder[m] = chain(m);
      builder.insert = () => {
        calls.push(`${table}.insert`);
        return Promise.resolve(response);
      };
      builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(response).then(resolve, reject);
      return builder;
    }
  };
  return { client: client as never, calls };
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k)
  };
}

const profile: ProfileData = {
  email: 'Student@Mail.RU ',
  display_name: '  Ученик ',
  avatar: '🚀',
  bio: 'bio',
  enrolled_courses: ['cpp-basics', 'cpp-basics'],
  completed_items: ['a', 'a', 'b'],
  user_code_map: { a: 'print(1)' }
};

// --- Тесты ---

test('saveProfile: шаг A — обновляет существующую строку', async () => {
  const { client, calls } = fakeClient([{ data: [{ id: '1' }], error: null }]);
  const result = await saveProfile(client, profile);
  assert.deepEqual(result, { ok: true, mode: 'updated' });
  assert.ok(!calls.includes('user_accounts.insert'));
});

test('saveProfile: шаг Б — вставляет, если строки нет', async () => {
  const { client, calls } = fakeClient([{ data: [], error: null }, { error: null }]);
  const result = await saveProfile(client, profile);
  assert.deepEqual(result, { ok: true, mode: 'inserted' });
  assert.ok(calls.includes('user_accounts.insert'));
});

test('saveProfile: шаг В — при гонке (23505) повторяет UPDATE', async () => {
  const { client } = fakeClient([
    { data: [], error: null },
    { error: { code: '23505', message: 'duplicate key' } },
    { data: [{ id: '1' }], error: null }
  ]);
  assert.deepEqual(await saveProfile(client, profile), { ok: true, mode: 'updated' });
});

test('saveProfile распознаёт бан из триггера БД', async () => {
  const { client } = fakeClient([{ data: null, error: { code: 'P0001', message: 'DC_ACCOUNT_BANNED: spam' } }]);
  const result = await saveProfile(client, profile);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.kind, 'banned');
});

test('classifySyncError: сеть, схема, неизвестное', () => {
  assert.equal(classifySyncError(new TypeError('Failed to fetch')).kind, 'offline');
  assert.equal(classifySyncError({ code: 'PGRST204', message: 'x' }).kind, 'schema');
  assert.equal(classifySyncError({ message: 'DC_READ_ONLY' }).kind, 'read-only');
  assert.equal(classifySyncError('???').kind, 'unknown');
});

test('parseCloudRow нормализует данные и служебные поля', () => {
  const row = parseCloudRow({ ...profile, is_banned: true, ban_reason: 'спам', bonus_xp: 12.7, role: 'admin' });
  assert.ok(row);
  assert.equal(row.profile.email, 'student@mail.ru');
  assert.equal(row.profile.display_name, 'Ученик');
  assert.deepEqual(row.profile.completed_items, ['a', 'b']);
  assert.deepEqual(row.meta, { isBanned: true, banReason: 'спам', bonusXp: 12, role: 'admin' });
  assert.equal(parseCloudRow({ display_name: 'x' }), null);
});

test('mergeLocalIntoCloud объединяет прогресс без дубликатов', () => {
  const cloud = { ...profile, email: 'student@mail.ru', completed_items: ['c', 'a'], user_code_map: { a: 'old', c: 'c' } };
  const merged = mergeLocalIntoCloud(profile, cloud);
  assert.deepEqual(merged.completed_items, ['c', 'a', 'b']);
  assert.deepEqual(merged.user_code_map, { a: 'print(1)', c: 'c' });
});

test('офлайн-очередь: сохраняет, читает и отправляет только для своего email', async () => {
  const storage = memoryStorage();
  queuePendingSync(storage, profile, 123);
  const pending = readPendingSync(storage);
  assert.equal(pending?.email, 'student@mail.ru');
  assert.equal(pending?.queuedAt, 123);

  // Чужой аккаунт: ничего не отправляем и не удаляем
  const other = fakeClient([]);
  assert.equal(await flushPendingSync(other.client, storage, 'other@mail.ru'), null);
  assert.ok(storage.data.has(PENDING_SYNC_KEY));

  const own = fakeClient([{ data: [{ id: '1' }], error: null }]);
  const result = await flushPendingSync(own.client, storage, 'STUDENT@mail.ru');
  assert.deepEqual(result, { ok: true, mode: 'updated' });
  assert.ok(!storage.data.has(PENDING_SYNC_KEY));
});

test('офлайн-очередь игнорирует старый флаг "1" и битый JSON', () => {
  const storage = memoryStorage();
  storage.setItem(PENDING_SYNC_KEY, '1');
  assert.equal(readPendingSync(storage), null);
  storage.setItem(PENDING_SYNC_KEY, '{oops');
  assert.equal(readPendingSync(storage), null);
});
