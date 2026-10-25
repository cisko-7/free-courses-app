'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { KeyRound, LayoutDashboard, Mail, FileText, Settings, Users, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAttemptLimiter } from '@/hooks/useAttemptLimiter';
import { ErrorNote, inputClass, Loading, primaryButton } from '@/components/admin/ui';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminSiteSettings from '@/components/admin/AdminSiteSettings';
import AdminEmailLogs from '@/components/admin/AdminEmailLogs';
import AdminAuditLog from '@/components/admin/AdminAuditLog';
import AdminSecurity from '@/components/admin/AdminSecurity';

type Tab = 'overview' | 'users' | 'settings' | 'email' | 'audit' | 'security';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Обзор', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'users', label: 'Пользователи', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
  { id: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { id: 'audit', label: 'Журнал', icon: <FileText className="w-4 h-4" /> },
  { id: 'security', label: 'ПИН', icon: <Shield className="w-4 h-4" /> }
];

async function checkPinRequired(): Promise<{ required: boolean; error: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_pin_status');
    if (error) return { required: false, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    return { required: r.is_set === true, error: '' };
  } catch {
    return { required: false, error: 'Ошибка сети.' };
  }
}

async function verifyPin(pin: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_verify_pin', { pin });
    if (error) return { ok: false, message: error.message };
    if (data === true) return { ok: true, message: '' };
    return { ok: false, message: 'Неверный ПИН.' };
  } catch {
    return { ok: false, message: 'Ошибка сети.' };
  }
}

function AdminDashboard() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'need_pin' | 'ready'>('checking');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { lockedForSec, tryAttempt, reset } = useAttemptLimiter('admin-pin', 5, 300_000);

  useEffect(() => {
    let alive = true;
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
        </div>
      </div>
    </div>
  );
}

export default memo(AdminDashboard);
