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

type Client = Pick<SupabaseClient, 'from'>;

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

/** Сохраняет настройки. Возвращает текст ошибки или null. */
export async function saveSiteSettings(client: Client, settings: SiteSettings): Promise<string | null> {
  try {
    const { data, error } = await client.from('site_settings').update(toSettingsRow(settings)).eq('id', 1).select('id');
    if (error) return error.message;
    // RLS молча отфильтровывает строку, если нет прав: UPDATE «проходит», но меняет 0 строк
    if (!Array.isArray(data) || data.length === 0) return 'Нет прав на изменение настроек (подтвердите ПИН администратора).';
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Не удалось сохранить настройки.';
  }
}

/** Пользователь может писать в БД (учитывает техработы и Read-Only). Администратор не ограничен. */
export function canWrite(settings: SiteSettings, isAdmin: boolean): boolean {
  return isAdmin || (!settings.maintenanceMode && !settings.readOnly);
}
