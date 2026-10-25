'use client';

import { Ban, LogOut } from 'lucide-react';

interface BannedScreenProps {
  email: string;
  reason: string;
  onLogout: () => void;
}

/**
 * Экран заблокированного аккаунта. Запись профиля для такого пользователя
 * запрещает триггер в БД (DC_ACCOUNT_BANNED), экран лишь объясняет ситуацию.
 */
export default function BannedScreen({ email, reason, onLogout }: BannedScreenProps) {
  return (
    <main id="main" className="min-h-screen flex items-center justify-center px-4 py-12">
      <section
        role="alert"
        aria-labelledby="banned-title"
        className="max-w-lg w-full p-8 rounded-3xl bg-slate-900/90 border border-rose-800/60 shadow-2xl text-center space-y-5"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 grid place-items-center">
          <Ban className="w-7 h-7 text-rose-300" aria-hidden="true" />
        </div>
        <h1 id="banned-title" className="text-2xl font-bold text-white">
          Аккаунт заблокирован
        </h1>
        <p className="text-sm text-slate-300">
          Доступ для <span className="font-semibold text-white break-all">{email}</span> ограничен администратором.
        </p>
        {reason && (
          <p className="text-sm text-rose-200 bg-rose-950/40 border border-rose-900/60 rounded-xl p-3 break-words">
            Причина: {reason}
          </p>
        )}
        <p className="text-xs text-slate-500">Если считаете это ошибкой, свяжитесь с администрацией платформы.</p>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Выйти из аккаунта
        </button>
      </section>
    </main>
  );
}
