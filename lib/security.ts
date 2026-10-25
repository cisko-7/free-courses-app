/**
 * Клиентская защита: санитизация ввода, нормализация прогресса, кулдауны и лимиты попыток.
 *
 * ВАЖНО: сайт статический (output: "export"), поэтому всё здесь — удобство и защита
 * от случайного мусора. Настоящая граница безопасности — RLS и триггеры в supabase/schema.sql.
 *
 * Модуль без runtime-импортов: его напрямую запускают тесты `node --test`.
 */

// --- ЛИМИТЫ (совпадают с CHECK-ограничениями в supabase/schema.sql) ---

export const LIMITS = {
  displayName: 60,
  bio: 500,
  avatar: 16,
  email: 254,
  id: 120,
  /** Максимум ID в enrolled_courses / completed_items */
  idList: 5000,
  /** Длина одного решения */
  code: 30_000,
  /** Суммарный объём user_code_map (символы); в БД лимит ~1 МБ */
  codeMapTotal: 900_000,
  searchQuery: 100,
  bannerText: 300,
  maintenanceMessage: 500,
  banReason: 300
} as const;

export const XP_PER_ITEM = 50;

// --- САНИТИЗАЦИЯ ТЕКСТА ---

/**
 * Управляющие символы C0/C1, zero-width и bidi-override (подмена направления текста).
 * Проверка по кодам, а не регуляркой: так не срабатывает правило no-control-regex.
 */
function isUnsafeCodePoint(cp: number, multiline: boolean): boolean {
  if (multiline && (cp === 0x09 || cp === 0x0a)) return false;
  return (
    cp <= 0x1f ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2066 && cp <= 0x2069) ||
    cp === 0xfeff
  );
}

function stripUnsafe(text: string, multiline: boolean): string {
  let out = '';
  for (const ch of text) {
    if (!isUnsafeCodePoint(ch.codePointAt(0) ?? 0, multiline)) out += ch;
  }
  return out;
}

/** Обрезает строку по кодовым точкам, чтобы не разрезать эмодзи пополам. */
function truncateCodePoints(value: string, max: number): string {
  if (value.length <= max) return value;
  return Array.from(value).slice(0, max).join('');
}

/**
 * Чистит пользовательский текст: нормализует Unicode, убирает опасные символы,
 * схлопывает пробелы и обрезает по длине.
 * React экранирует вывод сам — функция защищает данные в БД и вёрстку, а не от XSS.
 */
export function sanitizeText(value: unknown, maxLength: number, options: { multiline?: boolean } = {}): string {
  if (typeof value !== 'string') return '';
  const multiline = options.multiline === true;
  const normalized = value.normalize('NFC').replace(/\r\n?/g, '\n');
  let text = stripUnsafe(normalized, multiline);
  text = multiline
    ? text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');
  return truncateCodePoints(text.trim(), maxLength);
}

/**
 * Возвращает URL только с протоколом http(s), иначе пустую строку.
 * Блокирует javascript:, data: и прочие схемы в ссылках из настроек и писем.
 */
export function sanitizeUrl(value: unknown, allowedOrigins?: readonly string[]): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (url.username || url.password) return '';
    if (allowedOrigins && allowedOrigins.length > 0 && !allowedOrigins.includes(url.origin)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Готовит строку для фильтра PostgREST `.or('a.ilike.*q*,b.ilike.*q*')`.
 * Запятая, скобки, `*`, `%` и `\` ломают синтаксис фильтра или работают как wildcard,
 * поэтому оставляем только буквы, цифры, пробел и символы, встречающиеся в email.
 */
export function sanitizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[^\p{L}\p{N}@.\-+_ ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.searchQuery);
}

// --- ID И ПРОГРЕСС ---

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= LIMITS.id && SAFE_ID.test(value);
}

/**
 * Уникальные корректные ID с сохранением порядка.
 * Дубликаты в completed_items раньше раздували XP (XP = длина массива × 50).
 */
export function dedupeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!isSafeId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= LIMITS.idList) break;
  }
  return result;
}

/** Код решений: только безопасные ключи, строки ограниченной длины и общий бюджет объёма. */
export function sanitizeCodeMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  let total = 0;
  for (const [key, code] of Object.entries(value as Record<string, unknown>)) {
    if (!isSafeId(key) || typeof code !== 'string') continue;
    const clipped = code.slice(0, LIMITS.code);
    if (total + clipped.length > LIMITS.codeMapTotal) break;
    total += clipped.length;
    result[key] = clipped;
  }
  return result;
}

export interface ProgressInput {
  enrolled_courses: unknown;
  completed_items: unknown;
  user_code_map: unknown;
}

export interface SanitizedProgress {
  enrolled_courses: string[];
  completed_items: string[];
  user_code_map: Record<string, string>;
}

export function sanitizeProgress(input: ProgressInput): SanitizedProgress {
  return {
    enrolled_courses: dedupeIds(input.enrolled_courses),
    completed_items: dedupeIds(input.completed_items),
    user_code_map: sanitizeCodeMap(input.user_code_map)
  };
}

/** XP так же, как generated-колонка `xp` в БД: уникальные шаги × 50 + бонус администратора. */
export function computeXp(completedItems: readonly string[], bonusXp = 0): number {
  const bonus = Number.isFinite(bonusXp) ? Math.max(0, Math.trunc(bonusXp)) : 0;
  return new Set(completedItems).size * XP_PER_ITEM + bonus;
}

// --- КУЛДАУНЫ И ЛИМИТЫ ПОПЫТОК ---

export type Clock = () => number;

export interface Cooldown {
  /** Сколько миллисекунд осталось до разрешения действия (0 — можно). */
  remainingMs(): number;
  /** Можно ли выполнить действие прямо сейчас. */
  isReady(): boolean;
  /** Зафиксировать выполнение действия и запустить отсчёт. */
  trigger(): void;
}

/** Кулдаун в памяти: например, «не чаще одного письма в 60 секунд». */
export function createCooldown(intervalMs: number, now: Clock = Date.now): Cooldown {
  let lastAt = Number.NEGATIVE_INFINITY;
  const remainingMs = () => Math.max(0, lastAt + intervalMs - now());
  return {
    remainingMs,
    isReady: () => remainingMs() === 0,
    trigger: () => {
      lastAt = now();
    }
  };
}

export interface AttemptCheck {
  allowed: boolean;
  /** Через сколько секунд можно повторить (только если allowed = false). */
  retryAfterSec: number;
}

/**
 * Скользящее окно попыток: не больше maxAttempts за windowMs.
 * Это UX-барьер; Supabase Auth и RPC admin_verify_pin ограничивают попытки на сервере.
 */
export class AttemptLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: Clock;
  private attempts: number[] = [];

  constructor(maxAttempts: number, windowMs: number, now: Clock = Date.now) {
    this.maxAttempts = Math.max(1, Math.trunc(maxAttempts));
    this.windowMs = Math.max(1, windowMs);
    this.now = now;
  }

  private prune(): number {
    const current = this.now();
    this.attempts = this.attempts.filter((t) => current - t < this.windowMs && t <= current);
    return current;
  }

  check(): AttemptCheck {
    const current = this.prune();
    if (this.attempts.length < this.maxAttempts) return { allowed: true, retryAfterSec: 0 };
    const waitMs = this.attempts[0] + this.windowMs - current;
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
  }

  record(): void {
    this.prune();
    this.attempts.push(this.now());
  }

  reset(): void {
    this.attempts = [];
  }

  /** Состояние для sessionStorage: лимит переживает перезагрузку вкладки. */
  serialize(): string {
    this.prune();
    return JSON.stringify(this.attempts);
  }

  restore(raw: string | null): void {
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      this.attempts = Array.isArray(parsed)
        ? parsed.filter((t): t is number => typeof t === 'number' && Number.isFinite(t)).slice(-this.maxAttempts)
        : [];
      this.prune();
    } catch {
      this.attempts = [];
    }
  }
}

// --- АДМИНИСТРАТОР ---

export interface SessionLike {
  expires_at?: number;
  user?: { app_metadata?: Record<string, unknown> } | null;
}

/**
 * Права администратора берутся только из app_metadata.role живой сессии:
 * это поле пользователь изменить не может (в отличие от user_metadata).
 * Списки email из NEXT_PUBLIC_* для этого не годятся: они публичны и попадают в бандл.
 * Серверная проверка та же — функция public.is_admin() в RLS.
 */
export function isAdminSession(session: SessionLike | null | undefined, now: Clock = Date.now): boolean {
  if (!session?.user) return false;
  if (typeof session.expires_at === 'number' && session.expires_at * 1000 <= now()) return false;
  return session.user.app_metadata?.role === 'admin';
}
