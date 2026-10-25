'use client';

import { memo, useEffect, useState } from 'react';
import { BarChart3, Clock, Shield, ShieldAlert, TrendingUp, UserCheck, Users as UsersIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ErrorNote, formatDateTime, Loading, Panel } from './ui';

interface Stats {
  totalUsers: number;
  totalBanned: number;
  totalAdmins: number;
  totalXp: number;
  recentLogins: number;
  oldestAccount: string | null;
  newestAccount: string | null;
}

function parseStats(data: unknown): Stats {
  const fallback: Stats = {
    totalUsers: 0,
    totalBanned: 0,
    totalAdmins: 0,
    totalXp: 0,
    recentLogins: 0,
    oldestAccount: null,
    newestAccount: null
  };
  if (!data || typeof data !== 'object') return fallback;
  const r = data as Record<string, unknown>;
  return {
    totalUsers: Number(r.total_users) || 0,
    totalBanned: Number(r.total_banned) || 0,
    totalAdmins: Number(r.total_admins) || 0,
    totalXp: Number(r.total_xp) || 0,
    recentLogins: Number(r.recent_logins) || 0,
    oldestAccount: typeof r.oldest_account === 'string' ? r.oldest_account : null,
    newestAccount: typeof r.newest_account === 'string' ? r.newest_account : null
  };
}

async function loadStats(): Promise<{ stats: Stats | null; error: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_stats');
    if (error) return { stats: null, error: `Не удалось загрузить статистику: ${error.message}` };
    return { stats: parseStats(data), error: '' };
  } catch {
    return { stats: null, error: 'Ошибка сети или сервера.' };
  }
}

/** Главная страница админ-дашборда: статистика платформы. */
function AdminOverview() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let alive = true;
    void loadStats().then(({ stats: s, error }) => {
      if (!alive) return;
      if (error) {
        setStatus('error');
        setErrorMsg(error);
      } else {
        setStats(s);
        setStatus('ready');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (status === 'loading') return <Loading label="Загрузка статистики…" />;
  if (status === 'error' || !stats) return <ErrorNote message={errorMsg || 'Не удалось загрузить статистику.'} />;

  const cards = [
    { label: 'Всего пользователей', value: stats.totalUsers, Icon: UsersIcon, accent: 'text-blue-400' },
    { label: 'Недавно онлайн (7 дней)', value: stats.recentLogins, Icon: Clock, accent: 'text-emerald-400' },
    { label: 'Забанено', value: stats.totalBanned, Icon: ShieldAlert, accent: 'text-rose-400' },
    { label: 'Администраторов', value: stats.totalAdmins, Icon: UserCheck, accent: 'text-amber-400' },
    { label: 'XP на платформе', value: stats.totalXp, Icon: TrendingUp, accent: 'text-purple-400' }
  ];

  return (
    <Panel title="Обзор платформы" icon={<BarChart3 className="w-4 h-4 text-blue-400" />}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, Icon, accent }) => (
          <div key={label} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] grid place-items-center flex-shrink-0 ${accent}`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-bold text-white tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {(stats.oldestAccount || stats.newestAccount) && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="text-slate-400">Первый аккаунт:</span>
            <span className="text-white">{formatDateTime(stats.oldestAccount)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <span className="text-slate-400">Последняя регистрация:</span>
            <span className="text-white">{formatDateTime(stats.newestAccount)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default memo(AdminOverview);
