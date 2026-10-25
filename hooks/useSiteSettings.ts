'use client';

/**
 * Настройки сайта как общий внешний store (useSyncExternalStore):
 * один запрос на вкладку, мгновенный старт из кэша localStorage,
 * обновление при возврате на вкладку и раз в 2 минуты.
 */
import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_CACHE_KEY,
  fetchSiteSettings,
  parseSiteSettings,
  type SiteSettings
} from '@/lib/site-settings';
import { safeGet, safeSet } from '@/lib/safe-storage';

const REFRESH_MS = 120_000;

let current: SiteSettings = DEFAULT_SITE_SETTINGS;
let started = false;
const listeners = new Set<() => void>();

function emit(next: SiteSettings) {
  current = next;
  safeSet(SITE_SETTINGS_CACHE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/** Перезагрузить настройки с сервера (например, после сохранения в админке). */
export async function refreshSiteSettings(): Promise<void> {
  const fresh = await fetchSiteSettings(supabase);
  if (fresh) emit(fresh);
}

/** Применить настройки локально без запроса (оптимистичное обновление в админке). */
export function setSiteSettingsLocal(next: SiteSettings): void {
  emit(parseSiteSettings(next));
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const cached = safeGet(SITE_SETTINGS_CACHE_KEY);
  if (cached) {
    try {
      current = parseSiteSettings(JSON.parse(cached));
    } catch {
      /* битый кэш игнорируем */
    }
  }
  void refreshSiteSettings();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshSiteSettings();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshSiteSettings();
  }, REFRESH_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  // Кэш мог изменить значение во время старта — React перечитает снимок
  listener();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT_SITE_SETTINGS;

export function useSiteSettings(): SiteSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
