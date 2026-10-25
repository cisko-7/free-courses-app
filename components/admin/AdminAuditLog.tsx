'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AUDIT_ACTION_LABELS, fetchAuditLog, type AuditEntry } from '@/lib/audit-log';
import { formatDateTime, Loading, Panel, secondaryButton } from './ui';

/** Журнал действий администратора. */
function AdminAuditLog() {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const loadLog = useCallback(() => {
    setStatus('loading');
    void fetchAuditLog(supabase, 50).then(({ entries }) => {
      setEntries(entries);
      setStatus('ready');
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mounted) loadLog();
    return () => {
      mounted = false;
    };
  }, [loadLog]);

  return (
    <Panel
      title="Журнал действий"
      icon={<FileText className="w-4 h-4 text-blue-400" />}
      actions={
        <button type="button" onClick={loadLog} disabled={status === 'loading'} className={secondaryButton}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Обновить
        </button>
      }
    >
      {status === 'loading' && <Loading label="Загрузка журнала…" />}
      {status === 'ready' && entries.length === 0 && <p className="text-xs text-slate-400">Журнал пуст.</p>}
      {status === 'ready' && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={`${entry.createdAt}-${i}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white font-semibold">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
                <span className="text-slate-500 text-[10px] tabular-nums">{formatDateTime(entry.createdAt)}</span>
              </div>
              <p className="text-slate-400 break-all">{entry.actorEmail}</p>
              {entry.target && <p className="text-slate-300 text-[10px]">Цель: {entry.target}</p>}
              {Object.keys(entry.details).length > 0 && (
                <pre className="text-slate-300 bg-slate-900 px-2 py-1 rounded-lg break-words text-[10px] overflow-x-auto">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default memo(AdminAuditLog);
