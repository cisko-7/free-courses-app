'use client';

import { memo, useCallback, useState } from 'react';
import { Ban, CheckCircle2, Coins, Save, Search, ShieldAlert, UserCheck, Users as UsersIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeSearchQuery, sanitizeText, LIMITS } from '@/lib/security';
import { logAdminAction } from '@/lib/audit-log';
import { dangerButton, ErrorNote, inputClass, Loading, Panel, primaryButton, secondaryButton, SuccessNote } from './ui';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar: string;
  xp: number;
  is_banned: boolean;
  ban_reason: string;
  bonus_xp: number;
  role: 'user' | 'admin';
  last_seen_at: string | null;
  created_at: string;
}

function parseUserRows(data: unknown): UserRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const email = String(r.email ?? '');
    const id = String(r.id || r.user_id || email);
    return {
      id,
      email,
      display_name: sanitizeText(r.display_name, LIMITS.displayName) || 'Студент',
      avatar: sanitizeText(r.avatar, LIMITS.avatar) || '👨‍💻',
      xp: Number(r.xp) || 0,
      is_banned: r.is_banned === true,
      ban_reason: sanitizeText(r.ban_reason, LIMITS.banReason),
      bonus_xp: Number(r.bonus_xp) || 0,
      role: r.role === 'admin' ? 'admin' : 'user',
      last_seen_at: typeof r.last_seen_at === 'string' ? r.last_seen_at : null,
      created_at: typeof r.created_at === 'string' ? r.created_at : ''
    };
  });
}

async function searchUsers(query: string): Promise<{ rows: UserRow[]; error: string }> {
  const trimmed = query.trim();
  if (!trimmed) {
    try {
      const { data, error } = await supabase.from('user_accounts').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) return { rows: [], error: `Ошибка загрузки: ${error.message}` };
      return { rows: parseUserRows(data), error: '' };
    } catch {
      return { rows: [], error: 'Ошибка сети.' };
    }
  }
  const safe = sanitizeSearchQuery(trimmed);
  try {
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { rows: [], error: `Ошибка поиска: ${error.message}` };
    return { rows: parseUserRows(data), error: '' };
  } catch {
    return { rows: [], error: 'Ошибка сети.' };
  }
}

/** Бан/разбан пользователя. */
async function toggleBan(
  user: UserRow,
  currentlyBanned: boolean,
  reason?: string
): Promise<{ ok: boolean; updatedRow: UserRow | null; error: string }> {
  try {
    const nextBanned = !currentlyBanned;
    let query = supabase
      .from('user_accounts')
      .update({ is_banned: nextBanned, ban_reason: nextBanned ? (reason || 'Нарушение правил') : '' });

    // Если есть валидный id (UUID), обновляем по id, иначе по email
    if (user.id && !user.id.includes('@')) {
      query = query.eq('id', user.id);
    } else {
      query = query.eq('email', user.email);
    }

    const { data, error } = await query.select().single();
    if (error) return { ok: false, updatedRow: null, error: error.message };
    if (!data) return { ok: false, updatedRow: null, error: 'RLS заблокировал операцию. Подтвердите ПИН администратора.' };
    return { ok: true, updatedRow: parseUserRows([data])[0] ?? null, error: '' };
  } catch {
    return { ok: false, updatedRow: null, error: 'Ошибка сети.' };
  }
}

/** Изменение бонусного XP. */
async function setBonusXp(user: UserRow, bonus: number): Promise<{ ok: boolean; updatedRow: UserRow | null; error: string }> {
  try {
    let query = supabase
      .from('user_accounts')
      .update({ bonus_xp: bonus });

    // Если есть валидный id (UUID), обновляем по id, иначе по email
    if (user.id && !user.id.includes('@')) {
      query = query.eq('id', user.id);
    } else {
      query = query.eq('email', user.email);
    }

    const { data, error } = await query.select().single();
    if (error) return { ok: false, updatedRow: null, error: error.message };
    if (!data) return { ok: false, updatedRow: null, error: 'RLS заблокировал операцию. Подтвердите ПИН администратора.' };
    return { ok: true, updatedRow: parseUserRows([data])[0] ?? null, error: '' };
  } catch {
    return { ok: false, updatedRow: null, error: 'Ошибка сети.' };
  }
}

interface UserCardProps {
  user: UserRow;
  isBanning: boolean;
  isEditingBonus: boolean;
  banReasonInput: string;
  bonusInput: string;
  onBanReasonChange: (v: string) => void;
  onBonusChange: (v: string) => void;
  onBanClick: (u: UserRow) => void;
  onSubmitBan: (u: UserRow) => void;
  onCancelBan: () => void;
  onBonusClick: (u: UserRow) => void;
  onSubmitBonus: (u: UserRow) => void;
  onCancelBonus: () => void;
}

function UserCard({
  user,
  isBanning,
  isEditingBonus,
  banReasonInput,
  bonusInput,
  onBanReasonChange,
  onBonusChange,
  onBanClick,
  onSubmitBan,
  onCancelBan,
  onBonusClick,
  onSubmitBonus,
  onCancelBonus
}: UserCardProps) {
  return (
    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl" aria-hidden="true">
            {user.avatar}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {user.role === 'admin' && (
            <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
              <UserCheck className="w-3 h-3" aria-hidden="true" />
              Admin
            </span>
          )}
          {user.is_banned && (
            <span className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
              Забанен
            </span>
          )}
          <span className="text-xs text-slate-300 font-semibold tabular-nums">{user.xp} XP</span>
        </div>
      </div>

      {isBanning ? (
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-2">
          <p className="text-xs text-rose-200">{user.is_banned ? 'Снять блокировку?' : 'Причина блокировки:'}</p>
          {!user.is_banned && (
            <input
              type="text"
              value={banReasonInput}
              onChange={(e) => onBanReasonChange(e.target.value)}
              placeholder="Нарушение правил"
              className={inputClass}
            />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => onSubmitBan(user)} className={dangerButton}>
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              {user.is_banned ? 'Разбанить' : 'Забанить'}
            </button>
            <button type="button" onClick={onCancelBan} className={secondaryButton}>
              Отмена
            </button>
          </div>
        </div>
      ) : isEditingBonus ? (
        <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/40 space-y-2">
          <p className="text-xs text-blue-200">Бонус XP (неотрицательное число):</p>
          <input type="number" value={bonusInput} onChange={(e) => onBonusChange(e.target.value)} min="0" step="1" className={inputClass} />
          <div className="flex gap-2">
            <button type="button" onClick={() => onSubmitBonus(user)} className={primaryButton}>
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              Сохранить
            </button>
            <button type="button" onClick={onCancelBonus} className={secondaryButton}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-xs">
          {user.is_banned ? (
            <>
              <button type="button" onClick={() => onBanClick(user)} className={primaryButton}>
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Разбанить
              </button>
              {user.ban_reason && (
                <p className="text-rose-200 bg-rose-950/30 px-2 py-1 rounded-lg border border-rose-800/30">{user.ban_reason}</p>
              )}
            </>
          ) : (
            <button type="button" onClick={() => onBanClick(user)} className={dangerButton}>
              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
              Забанить
            </button>
          )}
          <button type="button" onClick={() => onBonusClick(user)} className={secondaryButton}>
            <Coins className="w-3.5 h-3.5" aria-hidden="true" />
            Бонус XP ({user.bonus_xp})
          </button>
        </div>
      )}
    </div>
  );
}

/** Управление пользователями: поиск, бан, бонус XP. */
function AdminUsers() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
  const [bonusInput, setBonusInput] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [banningId, setBanningId] = useState<string | null>(null);

  const doSearch = useCallback(() => {
    setStatus('loading');
    setErrorMsg('');
    setSuccessMsg('');
    void searchUsers(searchQuery).then(({ rows: r, error }) => {
      if (error) {
        setStatus('error');
        setErrorMsg(error);
      } else {
        setRows(r);
        setStatus('ready');
      }
    });
  }, [searchQuery]);

  const handleBan = useCallback(
    (user: UserRow) => {
      setBanningId(user.id);
      setBanReasonInput(user.ban_reason || '');
    },
    []
  );

  const submitBan = useCallback(
    (user: UserRow) => {
      const reason = banReasonInput.trim() || 'Нарушение правил';
      void toggleBan(user, user.is_banned, reason).then(({ ok, updatedRow, error }) => {
        if (ok) {
          setSuccessMsg(user.is_banned ? `${user.email} разбанен.` : `${user.email} забанен.`);
          setBanningId(null);
          // Обновляем локальный стейт без повторного запроса
          if (updatedRow) {
            setRows((prev) => prev.map((r) => (r.id === user.id ? updatedRow : r)));
          } else {
            doSearch();
          }
          void logAdminAction(supabase, user.is_banned ? 'admin.logout' : 'admin.login', user.email, {
            action: user.is_banned ? 'unban' : 'ban',
            reason
          });
        } else {
          setErrorMsg(error);
        }
      });
    },
    [banReasonInput, doSearch]
  );

  const cancelBan = useCallback(() => {
    setBanningId(null);
    setBanReasonInput('');
  }, []);

  const handleBonus = useCallback((user: UserRow) => {
    setEditingBonusId(user.id);
    setBonusInput(String(user.bonus_xp));
  }, []);

  const submitBonus = useCallback(
    (user: UserRow) => {
      const val = parseInt(bonusInput, 10);
      if (Number.isNaN(val) || val < 0) {
        setErrorMsg('Бонус XP должен быть неотрицательным.');
        return;
      }
      void setBonusXp(user, val).then(({ ok, updatedRow, error }) => {
        if (ok) {
          setSuccessMsg(`Бонус ${val} XP присвоен ${user.email}.`);
          setEditingBonusId(null);
          // Обновляем локальный стейт
          if (updatedRow) {
            setRows((prev) => prev.map((r) => (r.id === user.id ? updatedRow : r)));
          } else {
            doSearch();
          }
          void logAdminAction(supabase, 'admin.login', user.email, {
            action: 'bonus_xp',
            bonus_xp: val
          });
        } else {
          setErrorMsg(error);
        }
      });
    },
    [bonusInput, doSearch]
  );

  const cancelBonus = useCallback(() => {
    setEditingBonusId(null);
    setBonusInput('');
  }, []);

  return (
    <Panel title="Управление пользователями" icon={<UsersIcon className="w-4 h-4 text-blue-400" />}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="Email или имя…"
          className={inputClass}
        />
        <button type="button" onClick={doSearch} disabled={status === 'loading'} className={primaryButton}>
          <Search className="w-4 h-4" aria-hidden="true" />
          Поиск
        </button>
      </div>

      {errorMsg && <ErrorNote message={errorMsg} />}
      {successMsg && <SuccessNote message={successMsg} />}

      {status === 'loading' && <Loading label="Поиск…" />}
      {status === 'ready' && rows.length === 0 && <p className="text-xs text-slate-400">Пользователи не найдены.</p>}
      {status === 'ready' && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isBanning={banningId === u.id}
              isEditingBonus={editingBonusId === u.id}
              banReasonInput={banReasonInput}
              bonusInput={bonusInput}
              onBanReasonChange={setBanReasonInput}
              onBonusChange={setBonusInput}
              onBanClick={handleBan}
              onSubmitBan={submitBan}
              onCancelBan={cancelBan}
              onBonusClick={handleBonus}
              onSubmitBonus={submitBonus}
              onCancelBonus={cancelBonus}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

export default memo(AdminUsers);

