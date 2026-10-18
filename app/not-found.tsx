import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6 text-center">
      <div className="max-w-md space-y-6 animate-fade-up">
        <p
          aria-hidden="true"
          className="font-mono text-7xl sm:text-8xl font-extrabold tracking-tighter bg-gradient-to-b from-blue-300 to-blue-600 bg-clip-text text-transparent select-none"
        >
          404
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
          Такой страницы нет
        </h1>
        <p className="text-slate-400 leading-relaxed">
          Возможно, ссылка устарела или курс был перемещён. Вернитесь на главную и продолжите
          обучение.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          На главную
        </Link>
      </div>
    </main>
  );
}
