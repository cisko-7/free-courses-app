'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Lock, LogOut, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { dangerButton, ErrorNote, inputClass, Panel, primaryButton, secondaryButton, SuccessNote } from './ui';

interface PinStatus {
  admin: boolean;
  pinSet: boolean;
  verified: boolean;
}

async function loadPinStatus(): Promise<{ status: PinStatus | null; error: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_pin_status');
    if (error) return { status: null, error: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      status: {
        admin: r.admin === true,
        pinSet: r.pin_set === true,
        verified: r.verified === true
      },
      error: ''
    };
  } catch {
    return { status: null, error: 'Ошибка сети.' };
  }
}

async function setPin(newPin: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_set_pin', { pin_input: newPin });
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === true && r.pin_set === true) return { ok: true, message: 'ПИН-код установлен.' };
    const reason = typeof r.reason === 'string' ? r.reason : '';
    if (reason === 'not_admin') return { ok: false, message: 'Нет прав администратора.' };
    return { ok: false, message: 'Не удалось установить ПИН.' };
  } catch {
    return { ok: false, message: 'Ошибка сети.' };
  }
}

async function endSession(): Promise<{ ok: boolean; message: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_end_session');
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === true) return { ok: true, message: 'Админ-сессия завершена.' };
    return { ok: false, message: 'Не удалось завершить сессию.' };
  } catch {
    return { ok: false, message: 'Ошибка сети.' };
  }
}

/** Безопасность: установка/смена ПИН-кода и завершение сессии. */
function AdminSecurity() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'working'>('loading');
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  const loadStatus = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');
    void loadPinStatus().then(({ status: s, error }) => {
      if (error) {
        setErrorMsg(error);
      } else {
        setPinStatus(s);
      }
      setStatus('ready');
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mounted) loadStatus();
    return () => {
      mounted = false;
    };
  }, [loadStatus]);

  const handleSetPin = useCallback(() => {
    const pin = newPinInput.trim();
    if (pin.length < 4 || pin.length > 12 || !/^\d+$/.test(pin)) {
      setErrorMsg('ПИН должен содержать 4–12 цифр.');
      return;
    }
    if (pin !== confirmPinInput.trim()) {
      setErrorMsg('ПИН-коды не совпадают.');
      return;
    }
    setStatus('working');
    setErrorMsg('');
    setSuccessMsg('');
    void setPin(pin).then(({ ok, message }) => {
      if (ok) {
        setSuccessMsg(message);
        setNewPinInput('');
        setConfirmPinInput('');
        loadStatus();
      } else {
        setErrorMsg(message);
        setStatus('ready');
      }
    });
  }, [newPinInput, confirmPinInput, loadStatus]);

  const handleEndSession = useCallback(() => {
    if (!window.confirm('Завершить текущую админ-сессию? Для повторного входа потребуется ПИН.')) return;
    setStatus('working');
    setErrorMsg('');
    setSuccessMsg('');
    void endSession().then(({ ok, message }) => {
      if (ok) {
        setSuccessMsg(message);
        loadStatus();
      } else {
        setErrorMsg(message);
        setStatus('ready');
      }
    });
  }, [loadStatus]);

  if (status === 'loading') return <div className="text-xs text-slate-400">Загрузка статуса ПИН…</div>;

  return (
    <Panel title="Безопасность и ПИН-код" icon={<Lock className="w-4 h-4 text-blue-400" />}>
      {errorMsg && <ErrorNote message={errorMsg} />}
      {successMsg && <SuccessNote message={successMsg} />}

      {pinStatus?.pinSet ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">ПИН-код установлен</p>
              <p className="text-[10px] text-emerald-300">
                {pinStatus.verified
                  ? 'Сессия подтверждена (действует 30 минут).'
                  : 'Сессия не подтверждена — необходим ПИН для доступа.'}
              </p>
            </div>
          </div>

          {/* Форма смены ПИН-кода */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <p className="text-xs text-slate-400 font-semibold">Сменить ПИН-код</p>
            <div className="space-y-2">
              <label htmlFor="new-pin-change" className="block text-xs font-semibold text-slate-400">
                Новый ПИН (4–12 цифр)
              </label>
              <input
                id="new-pin-change"
                type="password"
                inputMode="numeric"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="••••"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-pin-change" className="block text-xs font-semibold text-slate-400">
                Повторите ПИН
              </label>
              <input
                id="confirm-pin-change"
                type="password"
                inputMode="numeric"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value)}
                placeholder="••••"
                className={inputClass}
              />
            </div>
            <button type="button" onClick={handleSetPin} disabled={status === 'working'} className={primaryButton}>
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              Сменить ПИН
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={handleEndSession} disabled={status === 'working'} className={dangerButton}>
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Завершить сессию
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Установите ПИН-код (4–12 цифр), чтобы защитить админ-дашборд. Без ПИНа доступ есть у всех пользователей с ролью admin.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="new-pin" className="block text-xs font-semibold text-slate-400">
                Новый ПИН (4–12 цифр)
              </label>
              <input
                id="new-pin"
                type="password"
                inputMode="numeric"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="••••"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-pin" className="block text-xs font-semibold text-slate-400">
                Повторите ПИН
              </label>
              <input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value)}
                placeholder="••••"
                className={inputClass}
              />
            </div>
            <button type="button" onClick={handleSetPin} disabled={status === 'working'} className={primaryButton}>
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              Установить ПИН
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default memo(AdminSecurity);
