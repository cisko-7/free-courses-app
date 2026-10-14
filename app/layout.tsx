import type { Metadata } from "next";
import Link from "next/link";
import { Code, Sparkles, Terminal } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevCourses — Интерактивная платформа курсов по программированию",
  description:
    "Изучай C++ и Python через интерактивное решение задач прямо в браузере с автопроверкой тестов.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark scroll-smooth">
      <body className="bg-slate-950 text-slate-200 min-h-screen flex flex-col antialiased selection:bg-blue-600 selection:text-white">
        {/* Header / Navbar with Glassmorphism */}
        <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-sm shadow-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform hover:scale-[1.02]"
              id="brand-logo"
            >
              <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 group-hover:bg-blue-600/25 group-hover:border-blue-500/50 transition-all shadow-sm shadow-blue-500/10">
                <Code className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-white">
                  DevCourses
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/30 hidden sm:inline-block">
                  Interactive
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-8">
              <Link
                href="/#dashboard"
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                Мои курсы
              </Link>
              <Link
                href="/#dashboard"
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                Каталог
              </Link>
              <Link
                href="/#features"
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                Возможности
              </Link>
            </nav>

            {/* Action button */}
            <div className="flex items-center gap-3">
              <Link
                href="/#dashboard"
                id="header-cta"
                className="inline-flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-500/25 transition-all duration-200 active:scale-[0.98]"
              >
                <span>Начать обучение</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content wrapper */}
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
