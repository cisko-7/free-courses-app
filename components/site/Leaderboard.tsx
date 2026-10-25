'use client';

import { memo, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LIMITS, sanitizeText } from '@/lib/security';

interface LeaderRow {
  place: number;
  name: string;
  avatar: string;
  xp: number;
  isMe: boolean;
}

function parseRows(data: unknown): LeaderRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      return {
        place: Number(r.place) || 0,
        name: sanitizeText(r.display_name, LIMITS.displayName) || 'Студент',
        avatar: sanitizeText(r.avatar, LIMITS.avatar) || '👨‍💻',
        xp: Number(r.xp) || 0,
        isMe: r.is_me === true
      };
    })
    .filter((r) => r.place > 0);
}

async function loadLeaderboard(): Promise<{ rows: LeaderRow[]; failed: boolean }> {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard', { lim: 10 });
    if (error) return { rows: [], failed: true };
    return { rows: parseRows(data), failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

const PLACE_STYLES = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

/** Топ-10 по XP (XP считает база: подделать с клиента нельзя). */
function Leaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    void loadLeaderboard().then(({ rows: next, failed }) => {
      if (!alive) return;
      setRows(next);
      setStatus(failed ? 'error' : 'ready');
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const refresh = () => {
    setStatus('loading');
    setNonce((n) => n + 1);
  };

  return (
    <section
      aria-labelledby="leaderboard-title"
      className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="leaderboard-title" className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" aria-hidden="true" />
          Лидерборд
        </h3>
        <button
          type="button"
          onClick={refresh}
          disabled={status === 'loading'}
          aria-label="Обновить лидерборд"
          className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 cursor-pointer disabled:opacity-50"
        >
          {status === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {status === 'error' && (
        <p role="alert" className="text-xs text-slate-400">
          Лидерборд пока недоступен. Попробуйте обновить позже.
        </p>
      )}
      {status === 'ready' && rows.length === 0 && (
        <p className="text-xs text-slate-400">Пока никто не набрал XP. Станьте первым.</p>
      )}

      {rows.length > 0 && (
        <ol className="space-y-1.5" aria-busy={status === 'loading'}>
          {rows.map((row) => (
            <li
              key={`${row.place}-${row.name}-${row.isMe}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                row.isMe ? 'bg-blue-600/15 border-blue-500/40' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <span className={`w-7 text-sm font-extrabold tabular-nums ${PLACE_STYLES[row.place - 1] ?? 'text-slate-500'}`}>
                {row.place}
              </span>
              <span className="text-lg leading-none" aria-hidden="true">
                {row.avatar}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm text-white">
                {row.name}
                {row.isMe && <span className="ml-1.5 text-[11px] text-blue-300">(вы)</span>}
              </span>
              <span className="text-sm font-bold text-amber-300 tabular-nums">{row.xp} XP</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default memo(Leaderboard);
