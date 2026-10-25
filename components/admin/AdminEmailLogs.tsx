'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchEmailLogs, sendTestEmail, type EmailLogEntry } from '@/lib/email';
import { ErrorNote, formatDateTime, Loading, Panel, primaryButton, secondaryButton, SuccessNote } from './ui';

/** История отправки писем и тестовое письмо. */
function AdminEmailLogs() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'sending'>('idle');
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const loadLogs = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');
    void fetchEmailLogs(supabase).then(({ entries }) => {
      setLogs(entries);
      setStatus('ready');
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mounted) loadLogs();
    return () => {
      mounted = false;
    };
  }, [loadLogs]);

  const handleTest = useCallback(() => {
    if (!testEmail.trim()) {
      setErrorMsg('Введите Email для теста.');
      return;
    }
    setStatus('sending');
    setErrorMsg('');
    setSuccessMsg('');
    void sendTestEmail(supabase, testEmail.trim()).then((error) => {
      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg('Тестовое письмо отправлено.');
        setTestEmail('');
        setTimeout(loadLogs, 500);
      }
      setStatus('ready');
    });
  }, [testEmail, loadLogs]);

  return (
    <Panel
      title="История писем"
      icon={<Mail className="w-4 h-4 text-blue-400" />}
      actions={
        <button type="button" onClick={loadLogs} disabled={status === 'loading'} className={secondaryButton}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Обновить
        </button>
      }
    >
      {errorMsg && <ErrorNote message={errorMsg} />}
      {successMsg && <SuccessNote message={successMsg} />}

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <p className="text-xs text-slate-400">Отправить тестовое письмо (проверка EmailJS):</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            placeholder="your@email.com"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
          />
          <button type="button" onClick={handleTest} disabled={status === 'sending'} className={primaryButton}>
            <Send className="w-4 h-4" aria-hidden="true" />
            {status === 'sending' ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>

      {status === 'loading' && <Loading label="Загрузка логов…" />}
      {status === 'ready' && logs.length === 0 && <p className="text-xs text-slate-400">Писем ещё не отправлялось.</p>}
      {status === 'ready' && logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div key={`${log.createdAt}-${i}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white font-semibold break-all">{log.recipient}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                    log.status === 'sent'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {log.status === 'sent' ? 'OK' : 'Ошибка'}
                </span>
              </div>
              <p className="text-slate-400">{log.template}</p>
              {log.error && <p className="text-rose-200 bg-rose-950/30 px-2 py-1 rounded-lg break-words">{log.error}</p>}
              <p className="text-slate-500 text-[10px]">{formatDateTime(log.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default memo(AdminEmailLogs);
