'use client';

/**
 * Клиентский лимит попыток (вход, ПИН) с сохранением в sessionStorage:
 * перезагрузка вкладки счётчик не сбрасывает. Серверные лимиты (Supabase Auth,
 * RPC admin_verify_pin) работают независимо — это только UX-барьер.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AttemptLimiter } from '@/lib/security';

function readSession(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* приватный режим */
  }
}

export interface AttemptLimiterHandle {
  /** Секунд до разблокировки (0 — можно пробовать). */
  lockedForSec: number;
  /** Регистрирует попытку; false — лимит исчерпан, попытку делать нельзя. */
  tryAttempt: () => boolean;
  /** Сброс после успешного действия. */
  reset: () => void;
}

export function useAttemptLimiter(storageKey: string, maxAttempts: number, windowMs: number): AttemptLimiterHandle {
  const limiterRef = useRef<AttemptLimiter | null>(null);
  const [lockedForSec, setLockedForSec] = useState(0);

  const getLimiter = useCallback(() => {
    if (!limiterRef.current) {
      const limiter = new AttemptLimiter(maxAttempts, windowMs);
      limiter.restore(readSession(storageKey));
      limiterRef.current = limiter;
    }
    return limiterRef.current;
  }, [maxAttempts, windowMs, storageKey]);

  // Обратный отсчёт блокировки
  useEffect(() => {
    if (lockedForSec <= 0) return;
    const timer = setTimeout(() => {
      const check = getLimiter().check();
      setLockedForSec(check.allowed ? 0 : check.retryAfterSec);
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockedForSec, getLimiter]);

  const tryAttempt = useCallback(() => {
    const limiter = getLimiter();
    const check = limiter.check();
    if (!check.allowed) {
      setLockedForSec(check.retryAfterSec);
      return false;
    }
    limiter.record();
    writeSession(storageKey, limiter.serialize());
    return true;
  }, [getLimiter, storageKey]);

  const reset = useCallback(() => {
    getLimiter().reset();
    writeSession(storageKey, '[]');
    setLockedForSec(0);
  }, [getLimiter, storageKey]);

  return { lockedForSec, tryAttempt, reset };
}
