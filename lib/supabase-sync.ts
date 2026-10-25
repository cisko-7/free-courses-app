/**
 * Надёжная синхронизация профиля `user_accounts` с Supabase.
 *
 * Сохранение в 3 шага (не зависит от того, есть ли строка и уникален ли email в старых базах):
 *   A. UPDATE ... WHERE email = :email RETURNING id  → строка есть, готово;
 *   Б. INSERT (строки нет)                           → создана;
 *   В. INSERT упал на 23505 (параллельная вкладка успела создать строку) → повторный UPDATE.
 *
 * Офлайн-очередь: последний несохранённый payload лежит в localStorage (PENDING_SYNC_KEY)
 * и отправляется через flushPendingSync() при старте, событии `online` и TOKEN_REFRESHED.
 *
 * Клиент Supabase и хранилище передаются параметрами — модуль тестируется без сети.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIMITS, sanitizeProgress, sanitizeText } from './security.ts';

export const PENDING_SYNC_KEY = 'dc_pending_sync';
const TABLE = 'user_accounts';

// --- ТИПЫ ---

export interface ProfileData {
  email: string;
  display_name: string;
  avatar: string;
  bio: string;
  enrolled_courses: string[];
  completed_items: string[];
  user_code_map: Record<string, string>;
}

/** Служебные поля строки, которые меняет только администратор (защищены триггером в БД). */
export interface ProfileMeta {
  isBanned: boolean;
  banReason: string;
  bonusXp: number;
  role: 'student' | 'admin';
}

export interface CloudRow {
  profile: ProfileData;
  meta: ProfileMeta;
}

export type SyncErrorKind = 'offline' | 'banned' | 'read-only' | 'auth' | 'schema' | 'unknown';

export type SaveResult =
  | { ok: true; mode: 'updated' | 'inserted' }
  | { ok: false; kind: SyncErrorKind; message: string; code?: string };

export interface PendingSync {
  email: string;
  payload: ProfileData;
  queuedAt: number;
}

/** Минимальный интерфейс хранилища (localStorage или заглушка в тестах). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PgError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

// --- НОРМАЛИЗАЦИЯ ---

export const DEFAULT_PROFILE_NAME = 'Студент DevCourses';
export const DEFAULT_PROFILE_AVATAR = '👨‍💻';

/** Приводит профиль к виду, который гарантированно проходит CHECK-ограничения таблицы. */
export function buildProfilePayload(profile: ProfileData): ProfileData {
  const progress = sanitizeProgress(profile);
  return {
    email: profile.email.trim().toLowerCase().slice(0, LIMITS.email),
    display_name: sanitizeText(profile.display_name, LIMITS.displayName) || DEFAULT_PROFILE_NAME,
    avatar: sanitizeText(profile.avatar, LIMITS.avatar) || DEFAULT_PROFILE_AVATAR,
    bio: sanitizeText(profile.bio, LIMITS.bio, { multiline: true }),
    ...progress
  };
}

/** Тело запроса без email: email на сервере всегда берётся из JWT (триггер enforce_owner). */
function toWritableColumns(payload: ProfileData): Omit<ProfileData, 'email'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { email, ...rest } = payload;
  return rest;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Разбор строки user_accounts; null, если строка пустая или без email. */
export function parseCloudRow(row: unknown): CloudRow | null {
  const r = asRecord(row);
  if (!r || typeof r.email !== 'string' || !r.email) return null;
  const profile = buildProfilePayload({
    email: r.email,
    display_name: typeof r.display_name === 'string' ? r.display_name : DEFAULT_PROFILE_NAME,
    avatar: typeof r.avatar === 'string' ? r.avatar : DEFAULT_PROFILE_AVATAR,
    bio: typeof r.bio === 'string' ? r.bio : '',
    enrolled_courses: r.enrolled_courses as string[],
    completed_items: r.completed_items as string[],
    user_code_map: r.user_code_map as Record<string, string>
  });
  const bonus = typeof r.bonus_xp === 'number' && Number.isFinite(r.bonus_xp) ? Math.max(0, Math.trunc(r.bonus_xp)) : 0;
  return {
    profile,
    meta: {
      isBanned: r.is_banned === true,
      banReason: typeof r.ban_reason === 'string' ? sanitizeText(r.ban_reason, LIMITS.banReason) : '',
      bonusXp: bonus,
      role: r.role === 'admin' ? 'admin' : 'student'
    }
  };
}

/**
 * Слияние несохранённых локальных правок с облаком: прогресс объединяется (работа не теряется),
 * текст и код берутся из локальной версии — она новее.
 */
export function mergeLocalIntoCloud(local: ProfileData, cloud: ProfileData): ProfileData {
  return buildProfilePayload({
    email: cloud.email,
    display_name: local.display_name || cloud.display_name,
    avatar: local.avatar || cloud.avatar,
    bio: local.bio,
    enrolled_courses: [...cloud.enrolled_courses, ...local.enrolled_courses],
    completed_items: [...cloud.completed_items, ...local.completed_items],
    user_code_map: { ...cloud.user_code_map, ...local.user_code_map }
  });
}

// --- КЛАССИФИКАЦИЯ ОШИБОК ---

const NETWORK_RE = /failed to fetch|network|timeout|offline|ECONNREFUSED|load failed|fetch failed/i;

/**
 * Триггер user_accounts_guard в БД бросает исключения с этими маркерами
 * (см. supabase/schema.sql): так клиент отличает бан и Read-Only от прочих ошибок.
 */
export const DB_MARKER_BANNED = 'DC_ACCOUNT_BANNED';
export const DB_MARKER_READ_ONLY = 'DC_READ_ONLY';

export interface ClassifiedError {
  kind: SyncErrorKind;
  message: string;
  code?: string;
}

export function classifySyncError(error: unknown): ClassifiedError {
  const e = (asRecord(error) ?? {}) as PgError;
  const message = typeof e.message === 'string' ? e.message : String(error);
  const code = typeof e.code === 'string' ? e.code : undefined;
  const text = `${code ?? ''} ${message} ${e.details ?? ''} ${e.hint ?? ''}`;

  if (text.includes(DB_MARKER_BANNED)) return { kind: 'banned', message, code };
  if (text.includes(DB_MARKER_READ_ONLY)) return { kind: 'read-only', message, code };
  if (NETWORK_RE.test(message)) return { kind: 'offline', message, code };
  if (/jwt|PGRST301|PGRST302|refresh token|not authenticated/i.test(text)) return { kind: 'auth', message, code };
  if (/PGRST204|PGRST205|42P01|42703|schema cache|does not exist|could not find/i.test(text)) {
    return { kind: 'schema', message, code };
  }
  return { kind: 'unknown', message, code };
}

// --- СОХРАНЕНИЕ (A → Б → В) ---

type Client = Pick<SupabaseClient, 'from'>;

async function updateByEmail(client: Client, payload: ProfileData): Promise<{ updated: boolean; error: PgError | null }> {
  const { data, error } = await client
    .from(TABLE)
    .update(toWritableColumns(payload))
    .eq('email', payload.email)
    .select('id');
  if (error) return { updated: false, error };
  return { updated: Array.isArray(data) && data.length > 0, error: null };
}

/**
 * Сохраняет профиль текущего пользователя. Никогда не бросает исключений.
 * RLS гарантирует, что UPDATE/INSERT затрагивают только строку владельца JWT.
 */
export async function saveProfile(client: Client, profile: ProfileData): Promise<SaveResult> {
  const payload = buildProfilePayload(profile);
  if (!payload.email) return { ok: false, kind: 'auth', message: 'Нет email пользователя' };

  try {
    // A. Обычный случай: строка уже есть
    const first = await updateByEmail(client, payload);
    if (first.error) return { ok: false, ...classifySyncError(first.error) };
    if (first.updated) return { ok: true, mode: 'updated' };

    // Б. Строки нет — создаём (email и user_id триггер всё равно возьмёт из JWT)
    const { error: insertError } = await client.from(TABLE).insert([payload]);
    if (!insertError) return { ok: true, mode: 'inserted' };

    // В. Гонка: строку только что создала другая вкладка — обновляем её
    if (insertError.code === '23505') {
      const retry = await updateByEmail(client, payload);
      if (retry.error) return { ok: false, ...classifySyncError(retry.error) };
      if (retry.updated) return { ok: true, mode: 'updated' };
    }
    return { ok: false, ...classifySyncError(insertError) };
  } catch (err) {
    return { ok: false, ...classifySyncError(err) };
  }
}

const PROFILE_COLUMNS =
  'email, display_name, avatar, bio, enrolled_courses, completed_items, user_code_map, is_banned, ban_reason, bonus_xp, role';

/** Загружает строку профиля по email. Ошибки возвращаются, а не бросаются. */
export async function fetchProfile(
  client: Client,
  email: string
): Promise<{ row: CloudRow | null; error: ClassifiedError | null }> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const { data, error } = await client.from(TABLE).select(PROFILE_COLUMNS).eq('email', cleanEmail).limit(1).maybeSingle();
    if (!error) return { row: parseCloudRow(data), error: null };

    // Миграция ещё не выполнена (нет новых колонок) — читаем всё, чтобы не ломать вход
    const classified = classifySyncError(error);
    if (classified.kind !== 'schema') return { row: null, error: classified };
    const fallback = await client.from(TABLE).select('*').eq('email', cleanEmail).limit(1).maybeSingle();
    if (fallback.error) return { row: null, error: classifySyncError(fallback.error) };
    return { row: parseCloudRow(fallback.data), error: null };
  } catch (err) {
    return { row: null, error: classifySyncError(err) };
  }
}

// --- ОФЛАЙН-ОЧЕРЕДЬ ---

function isProfileData(value: unknown): value is ProfileData {
  const r = asRecord(value);
  return (
    !!r &&
    typeof r.email === 'string' &&
    typeof r.display_name === 'string' &&
    typeof r.avatar === 'string' &&
    typeof r.bio === 'string' &&
    Array.isArray(r.enrolled_courses) &&
    Array.isArray(r.completed_items) &&
    !!asRecord(r.user_code_map)
  );
}

export function readPendingSync(storage: KeyValueStorage | null): PendingSync | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_SYNC_KEY);
    if (!raw || raw === '1') return null; // '1' — флаг старого формата без данных
    const parsed = asRecord(JSON.parse(raw));
    if (!parsed || typeof parsed.email !== 'string' || !isProfileData(parsed.payload)) return null;
    return {
      email: parsed.email,
      payload: buildProfilePayload(parsed.payload),
      queuedAt: typeof parsed.queuedAt === 'number' ? parsed.queuedAt : 0
    };
  } catch {
    return null;
  }
}

/** Кладёт последний payload в очередь (предыдущий перезаписывается: он устарел). */
export function queuePendingSync(storage: KeyValueStorage | null, profile: ProfileData, now: number = Date.now()): void {
  if (!storage) return;
  const payload = buildProfilePayload(profile);
  try {
    storage.setItem(PENDING_SYNC_KEY, JSON.stringify({ email: payload.email, payload, queuedAt: now }));
  } catch {
    // Переполнение хранилища: данные остаются в памяти и уйдут при следующей удачной попытке
  }
}

export function clearPendingSync(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(PENDING_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Отправляет отложенный профиль, если он принадлежит текущему пользователю.
 * Чужая очередь (другой аккаунт на этом устройстве) не отправляется и не удаляется.
 */
export async function flushPendingSync(
  client: Client,
  storage: KeyValueStorage | null,
  currentEmail: string | null | undefined
): Promise<SaveResult | null> {
  const pending = readPendingSync(storage);
  const email = currentEmail?.trim().toLowerCase();
  if (!pending || !email || pending.email !== email) return null;
  const result = await saveProfile(client, pending.payload);
  // Бан повтором не лечится: очередь чистим, чтобы не долбить сервер
  if (result.ok || result.kind === 'banned') clearPendingSync(storage);
  return result;
}

/** localStorage, если доступен (SSR, приватный режим и запрет cookies дают null). */
export function browserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__dc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
