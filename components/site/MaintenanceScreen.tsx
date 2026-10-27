'use client';

import Link from 'next/link';
import { KeyRound, RefreshCw, Wrench } from 'lucide-react';

interface MaintenanceScreenProps {
  message: string;
}

/**
 * Экран технических работ. Это только UX: запись в БД во время техработ
 * блокирует триггер user_accounts_guard, поэтому обход экрана ничего не даёт.
 */
export default function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  return (
    <main id="main" className="min-h-screen flex items-center justify-center px-4 py-12">
      <section
        aria-labelledby="maintenance-title"
        className="max-w-lg w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl text-center space-y-5"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 grid place-items-center">
          <Wrench className="w-7 h-7 text-amber-300" aria-hidden="true" />
        </div>
        <h1 id="maintenance-title" className="text-2xl font-bold text-white">
          Технические работы
        </h1>
        <p className="text-sm text-slate-300 whitespace-pre-line break-words">{message}</p>
        <p className="text-xs text-slate-500">Ваш прогресс сохранён. Загляните чуть позже.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Обновить страницу
        </button>

        <div className="pt-2 border-t border-slate-800">
          <Link
            href="/admin"
            className="mt-4 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            🔐 Вход для администратора
          </Link>
          <p className="mt-2 text-xs text-slate-600">
            Панель администратора доступна даже во время технических работ.
          </p>
        </div>
      </section>
    </main>
  );
}
