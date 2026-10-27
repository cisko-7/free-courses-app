/**
 * Настройки сайта (таблица site_settings, одна строка id = 1).
 * Читают все, меняет только подтверждённый администратор (RLS).
 * Флаги техработ и Read-Only дополнительно применяет триггер БД — клиентский
 * экран техработ лишь UX, обойти серверную блокировку записи нельзя.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIMITS, sanitizeText } from './security.ts';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

export interface SiteSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  readOnly: boolean;
  registrationOpen: boolean;
  bannerEnabled: boolean;
  bannerText: string;
  bannerTone: BannerTone;
  updatedAt: string | null;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'Идут технические работы. Скоро вернёмся!',
  readOnly: false,
  registrationOpen: true,
  bannerEnabled: false,
  bannerText: '',
  bannerTone: 'info',
  updatedAt: null
};

export const BANNER_TONES: readonly BannerTone[] = ['info', 'success', 'warning', 'danger'];

/** Кэш в localStorage: настройки применяются мгновенно, ещё до ответа сервера. */
export const SITE_SETTINGS_CACHE_KEY = 'dc_site_settings';

const COLUMNS =
  'maintenance_mode, maintenance_message, read_only, registration_open, banner_enabled, banner_text, banner_tone, updated_at';

/** Клиенту нужен доступ к таблицам (from), RPC-функциям (rpc) и сессии (auth). */
type Client = Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;

/** Минимальная форма ошибки Supabase/PostgREST. */
interface SupabaseError {
  code?: string | null;
  message?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Разбор строки БД (snake_case) или кэша (camelCase) с безопасными значениями по умолчанию. */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const r = asRecord(raw);
  if (!r) return { ...DEFAULT_SITE_SETTINGS };
  const pick = (snake: string, camel: string) => (snake in r ? r[snake] : r[camel]);
  const tone = pick('banner_tone', 'bannerTone');
  const message = sanitizeText(pick('maintenance_message', 'maintenanceMessage'), LIMITS.maintenanceMessage, {
    multiline: true
  });
  const updatedAt = pick('updated_at', 'updatedAt');
  return {
    maintenanceMode: bool(pick('maintenance_mode', 'maintenanceMode'), false),
    maintenanceMessage: message || DEFAULT_SITE_SETTINGS.maintenanceMessage,
    readOnly: bool(pick('read_only', 'readOnly'), false),
    registrationOpen: bool(pick('registration_open', 'registrationOpen'), true),
    bannerEnabled: bool(pick('banner_enabled', 'bannerEnabled'), false),
    bannerText: sanitizeText(pick('banner_text', 'bannerText'), LIMITS.bannerText),
    bannerTone: BANNER_TONES.includes(tone as BannerTone) ? (tone as BannerTone) : 'info',
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null
  };
}

/** Поля для UPDATE (snake_case), уже очищенные. */
export function toSettingsRow(settings: SiteSettings): Record<string, unknown> {
  const clean = parseSiteSettings(settings);
  return {
    maintenance_mode: clean.maintenanceMode,
    maintenance_message: clean.maintenanceMessage,
    read_only: clean.readOnly,
    registration_open: clean.registrationOpen,
    banner_enabled: clean.bannerEnabled && clean.bannerText.length > 0,
    banner_text: clean.bannerText,
    banner_tone: clean.bannerTone
  };
}

/** Загружает настройки. При ошибке (нет сети, таблица ещё не создана) возвращает null. */
export async function fetchSiteSettings(client: Client): Promise<SiteSettings | null> {
  try {
    const { data, error } = await client.from('site_settings').select(COLUMNS).eq('id', 1).maybeSingle();
    if (error || !data) return null;
    return parseSiteSettings(data);
  } catch {
    return null;
  }
}

/** Признак ошибки «нет прав» (RLS/GRANT): PostgreSQL код 42501 или текст permission denied. */
function isPermissionError(err: SupabaseError | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42501') return true;
  return /permission denied|insufficient privilege/i.test(err.message ?? '');
}

/** Сохраняет настройки в кэш localStorage (camelCase), чтобы клиент применил их мгновенно. */
export function cacheSiteSettings(settings: SiteSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify(parseSiteSettings(settings)));
  } catch {
    /* localStorage может быть недоступен (инкогнито, переполнение) */
  }
}

/** Полностью очищает кэш настроек сайта (для экстренного сброса техработ). */
export function clearSiteSettingsCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SITE_SETTINGS_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Активна ли сейчас сессия Supabase. При ошибке считаем, что сессии нет. */
async function hasActiveSession(client: Client): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}

const SESSION_EXPIRED_MSG = 'Сессия истекла. Пожалуйста, войдите в аккаунт администратора заново.';

/**
 * Сохраняет настройки. Возвращает текст ошибки или null.
 * Порядок: RPC admin_save_site_settings (SECURITY DEFINER, обходит RLS) →
 * при отсутствии RPC в БД fallback на upsert таблицы site_settings.
 * При permission denied / 42501 проверяем сессию и подсказываем войти заново.
 * Успешное сохранение дублируется в localStorage, чтобы тумблеры применялись сразу.
 */
export async function saveSiteSettings(client: Client, settings: SiteSettings): Promise<string | null> {
  const row = toSettingsRow(settings);

  // 1. Пытаемся через RPC с SECURITY DEFINER — он не зависит от табличных GRANT/RLS.
  try {
    const { error } = await client.rpc('admin_save_site_settings', { payload: row });
    if (!error) {
      cacheSiteSettings(settings);
      return null;
    }
    // RPC ещё не создана в БД (PGRST202 / undefined function 42883) — переходим к fallback.
    const rpcMissing =
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /could not find the function|does not exist|not found/i.test(error.message ?? '');
    if (!rpcMissing) {
      if (isPermissionError(error)) {
        return (await hasActiveSession(client))
          ? 'Нет прав на изменение настроек (подтвердите ПИН администратора).'
          : SESSION_EXPIRED_MSG;
      }
      if (/DC_FORBIDDEN|требуется вход администратора/i.test(error.message ?? '')) {
        return (await hasActiveSession(client))
          ? 'Нет прав на изменение настроек (подтвердите ПИН администратора).'
          : SESSION_EXPIRED_MSG;
      }
      return error.message ?? 'Не удалось сохранить настройки.';
    }
  } catch {
    /* сеть/клиент упали на RPC — пробуем прямой upsert ниже */
  }

  // 2. Fallback: upsert единственной строки (id = 1).
  try {
    const { data, error } = await client
      .from('site_settings')
      .upsert([{ id: 1, ...row }], { onConflict: 'id' })
      .select('id');

    if (error) {
      if (isPermissionError(error)) {
        return (await hasActiveSession(client)) ? 'Нет прав на изменение настроек (подтвердите ПИН администратора).' : SESSION_EXPIRED_MSG;
      }
      return error.message;
    }
    // RLS молча отфильтровывает строку, если нет прав: UPDATE «проходит», но меняет 0 строк
    if (!Array.isArray(data) || data.length === 0) {
      return (await hasActiveSession(client)) ? 'Нет прав на изменение настроек (подтвердите ПИН администратора).' : SESSION_EXPIRED_MSG;
    }
    cacheSiteSettings(settings);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Не удалось сохранить настройки.';
  }
}

/** Пользователь может писать в БД (учитывает техработы и Read-Only). Администратор не ограничен. */
export function canWrite(settings: SiteSettings, isAdmin: boolean): boolean {
  return isAdmin || (!settings.maintenanceMode && !settings.readOnly);
}
