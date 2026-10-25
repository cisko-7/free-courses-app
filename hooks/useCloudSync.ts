'use client';

/**
 * Фоновая синхронизация профиля с Supabase.
 *  * отправка через 1,5 с после последней правки (debounce);
 *  * перед отправкой payload кладётся в офлайн-очередь (localStorage) и не теряется
 *    при закрытии вкладки или отсутствии сети;
 *  * повтор: `online`, TOKEN_REFRESHED, возврат на вкладку, старт приложения;
 *  * при уходе со страницы (visibilitychange → hidden, pagehide) очередь пишется синхронно;
 *  * запросы идут строго по одному: параллельные сохранения не перетирают друг друга.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  browserStorage,
  buildProfilePayload,
  clearPendingSync,
  queuePendingSync,
  saveProfile,
  type ProfileData,
  type SaveResult
} from '@/lib/supabase-sync';
import type { SyncStatus } from '@/lib/auth-utils';

export const SYNC_DEBOUNCE_MS = 1500;

export type BlockedKind = 'banned' | 'read-only';

interface UseCloudSyncOptions {
  /** Текущий профиль (мемоизированный объект) или null для гостя. */
  profile: ProfileData | null;
  /** Синхронизация разрешена (данные загружены, нет бана, нет Read-Only). */
  enabled: boolean;
  /** Сервер отклонил запись из-за бана или режима Read-Only. */
  onBlocked?: (kind: BlockedKind, message: string) => void;
}

export interface CloudSyncHandle {
  status: SyncStatus;
  /** Немедленное сохранение (кнопка «Сохранить в облако»). */
  saveNow: () => Promise<SaveResult | null>;
  /** Отметить профиль как совпадающий с облаком (после загрузки или создания строки). */
  markSynced: (profile: ProfileData) => void;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const serialize = (p: ProfileData) => JSON.stringify(buildProfilePayload(p));

export function useCloudSync({ profile, enabled, onBlocked }: UseCloudSyncOptions): CloudSyncHandle {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const latestRef = useRef<ProfileData | null>(null);
  const lastSyncedRef = useRef<string>('');
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  /** Одна попытка отправить актуальный профиль. Вызывается только через очередь chainRef. */
  const pushOnce = useCallback(async (): Promise<SaveResult | null> => {
    const current = latestRef.current;
    if (!current) return null;
    const payload = buildProfilePayload(current);
    const json = JSON.stringify(payload);
    const storage = browserStorage();

    if (json === lastSyncedRef.current) {
      clearPendingSync(storage);
      return { ok: true, mode: 'updated' };
    }

    queuePendingSync(storage, payload);
    if (isOffline()) {
      setStatus('offline-pending');
      return null;
    }

    setStatus('syncing');
    const result = await saveProfile(supabase, payload);

    if (result.ok) {
      lastSyncedRef.current = json;
      // Пока шёл запрос, могли появиться новые правки — тогда очередь не трогаем
      const latest = latestRef.current;
      if (latest && serialize(latest) === json) clearPendingSync(storage);
      setStatus('synced');
      return result;
    }

    if (result.kind === 'offline') {
      setStatus('offline-pending');
    } else if (result.kind === 'banned' || result.kind === 'read-only') {
      if (result.kind === 'banned') clearPendingSync(storage);
      setStatus('error');
      onBlockedRef.current?.(result.kind, result.message);
    } else {
      console.error('Cloud sync failed:', result.kind, result.code ?? '', result.message);
      setStatus('error');
    }
    return result;
  }, []);

  /** Ставит отправку в очередь: запросы выполняются строго последовательно. */
  const push = useCallback((): Promise<SaveResult | null> => {
    const run = chainRef.current.then(pushOnce, pushOnce);
    chainRef.current = run.catch(() => undefined);
    return run;
  }, [pushOnce]);

  const markSynced = useCallback((synced: ProfileData) => {
    lastSyncedRef.current = serialize(synced);
    latestRef.current = synced;
    clearPendingSync(browserStorage());
  }, []);

  // Debounce: отправка через 1,5 с после последнего изменения профиля
  useEffect(() => {
    latestRef.current = enabled ? profile : null;
    if (!enabled || !profile) return;
    const timer = setTimeout(() => {
      void push();
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [profile, enabled, push]);

  // Повторы и сохранение при уходе со страницы
  useEffect(() => {
    if (!enabled) return;

    const retry = () => {
      void push();
    };
    // Очередь пишем синхронно: fetch при закрытии вкладки может не успеть
    const flushNow = () => {
      const current = latestRef.current;
      if (!current || serialize(current) === lastSyncedRef.current) return;
      queuePendingSync(browserStorage(), current);
      void push();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
      else retry();
    };

    window.addEventListener('online', retry);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    // Внутри колбэка onAuthStateChange нельзя ждать запросы Supabase (deadlock) — откладываем
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') setTimeout(retry, 0);
    });
    // Старт: отправляем то, что могло остаться в очереди с прошлого раза
    const startTimer = setTimeout(retry, 0);

    return () => {
      clearTimeout(startTimer);
      window.removeEventListener('online', retry);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      sub.subscription.unsubscribe();
    };
  }, [enabled, push]);

  return { status: enabled ? status : 'idle', saveNow: push, markSynced };
}
