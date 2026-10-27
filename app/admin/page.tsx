'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { KeyRound, LayoutDashboard, LogIn, LogOut, Mail, FileText, Settings, ShieldAlert, Users, Shield, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isAdminSession } from '@/lib/security';
import { translateAuthError, isValidEmail } from '@/lib/auth-utils';
import { useAttemptLimiter } from '@/hooks/useAttemptLimiter';
import { ErrorNote, inputClass, Loading, primaryButton, secondaryButton } from '@/components/admin/ui';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminSiteSettings from '@/components/admin/AdminSiteSettings';
import AdminEmailLogs from '@/components/admin/AdminEmailLogs';
import AdminAuditLog from '@/components/admin/AdminAuditLog';
import AdminSecurity from '@/components/admin/AdminSecurity';
import AdminAI from '@/components/admin/AdminAI';

type Tab = 'overview' | 'users' | 'settings' | 'email' | 'audit' | 'security' | 'ai';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Обзор', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Пользователи', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
  { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { id: 'audit', label: 'Журнал', icon: <FileText className="w-4 h-4" /> },
  { id: 'security', label: 'ПИН', icon: <Shield className="w-4 h-4" /> },
  { id: 'ai', label: '🤖 ИИ-Пилот', icon: <Zap className="w-4 h-4" /> }
];

async function checkPinRequired(): Promise<{ required: boolean; error: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_pin_status');
    if (error) return { required: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    // БД возвращает: { admin: bool, pin_set: bool, verified: bool }
    if (r.admin !== true) return { required: false, error: 'Нет прав администратора.' };
    // Если ПИН установлен и сессия ещё не подтверждена — запрашиваем ПИН
    return { required: r.pin_set === true && r.verified !== true, error: '' };
  } catch {
    return { required: false, error: 'Ошибка сети.' };
  }
}

async function verifyPin(pin: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_verify_pin', { pin_input: pin });
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === true && r.verified === true) return { ok: true, message: '' };
    const reason = typeof r.reason === 'string' ? r.reason : '';
    if (reason === 'wrong_pin') return { ok: false, message: 'Неверный ПИН-код.' };
    if (reason === 'not_admin') return { ok: false, message: 'Нет прав администратора.' };
    return { ok: false, message: 'Не удалось проверить ПИН.' };
  } catch {
    return { ok: false, message: 'Ошибка сети.' };
  }
}

/**
 * Встроенная форма входа администратора прямо в /admin.
 * Работает автономно, даже когда весь сайт закрыт на техработы: вход через /admin
 * никогда не блокируется maintenanceMode или readOnlyMode.
 */
function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { lockedForSec, tryAttempt, reset } = useAttemptLimiter('admin-login', 8, 300_000);

  const handleSignIn = useCallback(() => {
    if (lockedForSec > 0) {
      setErrorMsg(`Слишком много попыток. Подождите ${Math.ceil(lockedForSec / 60)} мин.`);
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Введите корректный Email.');
      return;
    }
    if (!password) {
      setErrorMsg('Введите пароль.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    void supabase.auth
      .signInWithPassword({ email: cleanEmail, password })
      .then(({ data, error }) => {
        if (error || !data.session) {
          if (!tryAttempt()) {
            setErrorMsg('Слишком много неудачных попыток. Подождите несколько минут.');
          } else {
            setErrorMsg(translateAuthError(error?.message));
          }
          return;
        }
        // Успешный вход: onAuthStateChange в дашборде подхватит новую сессию.
        reset();
        setPassword('');
      })
      .catch(() => setErrorMsg('Не удалось выполнить вход. Попробуйте ещё раз.'))
      .finally(() => setLoading(false));
  }, [email, password, lockedForSec, tryAttempt, reset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30">
            <LogIn className="w-6 h-6 text-blue-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Вход в панель администратора</h1>
            <p className="text-xs text-slate-400">Доступно даже во время технических работ</p>
          </div>
        </div>
        {errorMsg && <ErrorNote message={errorMsg} />}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-300">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              placeholder="admin@example.com"
              autoFocus
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-300">
              Пароль
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <button type="button" onClick={handleSignIn} disabled={loading} className={primaryButton + ' w-full'}>
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {loading ? 'Вход…' : 'Войти в панель администратора'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Экран для вошедшего пользователя без прав администратора. */
function NotAdminScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 grid place-items-center">
          <ShieldAlert className="w-7 h-7 text-rose-300" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Нет прав администратора</h1>
          <p className="text-sm text-slate-300 break-words">
            Аккаунт <span className="font-semibold text-white">{email}</span> не имеет прав администратора.
          </p>
        </div>
        <button type="button" onClick={onSignOut} className={secondaryButton + ' w-full'}>
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Выйти и сменить аккаунт
        </button>
      </div>
    </div>
  );
}

function AdminDashboard() {
  // Сессия: null — не вошёл; права определяем на клиенте (реальная защита — RLS).
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'need_pin' | 'ready'>('checking');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { lockedForSec, tryAttempt, reset } = useAttemptLimiter('admin-pin', 5, 300_000);

  const isAdmin = isAdminSession(session);
  const adminEmail = session?.user?.email ?? '';

  // Следим за сессией: вход/выход в этой или другой вкладке мгновенно обновляет /admin.
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionChecked(true);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Проверку ПИНа запускаем только когда подтверждены права администратора.
  useEffect(() => {
    if (!isAdmin) {
      setAuthStatus('checking');
      return;
    }
    let alive = true;
    setAuthStatus('checking');
    setErrorMsg('');
    void checkPinRequired().then(({ required, error }) => {
      if (!alive) return;
      if (error) {
        setErrorMsg(error);
        setAuthStatus('ready');
      } else {
        setAuthStatus(required ? 'need_pin' : 'ready');
      }
    });
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  const handleSignOut = useCallback(() => {
    void supabase.auth.signOut().finally(() => {
      setSession(null);
      setAuthStatus('checking');
      setErrorMsg('');
    });
  }, []);

  const handlePinSubmit = useCallback(() => {
    if (lockedForSec > 0) {
      setErrorMsg(`Слишком много попыток. Подождите ${Math.ceil(lockedForSec / 60)} мин.`);
      return;
    }
    const pin = pinInput.trim();
    if (!pin) {
      setErrorMsg('Введите ПИН-код.');
      return;
    }
    setErrorMsg('');
    void verifyPin(pin).then(({ ok, message }) => {
      if (ok) {
        setPinInput('');
        reset();
        setAuthStatus('ready');
      } else {
        if (!tryAttempt()) {
          setErrorMsg('Слишком много неверных попыток. Подождите несколько минут.');
        } else {
          setErrorMsg(message);
        }
      }
    });
  }, [pinInput, lockedForSec, tryAttempt, reset]);

  // Пока не узнали, есть ли сессия, показываем загрузку.
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
        <Loading label="Проверка доступа…" />
      </div>
    );
  }

  // Нет сессии — встроенная форма входа (работает даже в режиме техработ).
  if (!session) {
    return <AdminLoginForm />;
  }

  // Вошёл, но не администратор — понятное сообщение и смена аккаунта.
  if (!isAdmin) {
    return <NotAdminScreen email={adminEmail} onSignOut={handleSignOut} />;
  }

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
        <Loading label="Проверка доступа…" />
      </div>
    );
  }

  if (authStatus === 'need_pin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30">
              <KeyRound className="w-6 h-6 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Вход в админку</h1>
              <p className="text-xs text-slate-400">Введите ПИН-код</p>
            </div>
          </div>
          {errorMsg && <ErrorNote message={errorMsg} />}
          <div className="space-y-3">
            <label htmlFor="admin-pin" className="block text-sm font-semibold text-slate-300">
              ПИН-код
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              placeholder="••••••••"
              autoFocus
              className={inputClass}
            />
            <button type="button" onClick={handlePinSubmit} className={primaryButton + ' w-full'}>
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Админ-дашборд
            </h1>
            <p className="text-xs text-slate-400 mt-1">Управление платформой и пользователями</p>
          </div>
          <div className="flex items-center gap-3">
            {adminEmail && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 max-w-[220px] truncate" title={adminEmail}>
                <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{adminEmail}</span>
              </span>
            )}
            <button type="button" onClick={handleSignOut} className={secondaryButton}>
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Выйти из аккаунта
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto pb-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                  : 'bg-slate-900/50 border border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:border-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <div role="tabpanel">
          {activeTab === 'overview' && <AdminOverview />}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'settings' && <AdminSiteSettings />}
          {activeTab === 'email' && <AdminEmailLogs />}
          {activeTab === 'audit' && <AdminAuditLog />}
          {activeTab === 'security' && <AdminSecurity />}
          {activeTab === 'ai' && <AdminAI />}
        </div>
      </div>
    </div>
  );
}

export default memo(AdminDashboard);
