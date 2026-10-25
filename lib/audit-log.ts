/**
 * Журнал действий администратора (таблица audit_log).
 * Бан, бонусы, роль, удаление профилей и изменение настроек пишут триггеры БД,
 * отсюда — только действия без серверного следа (публикация курсов, тестовое письмо).
 * Автор записи (actor_id/actor_email) проставляется триггером, подделать его нельзя.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = Pick<SupabaseClient, 'from'>;

export type AuditAction = 'courses.publish' | 'email.test' | 'admin.login' | 'admin.logout';

export interface AuditEntry {
  id: number;
  actorEmail: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Ограничиваем размер details: в БД лимит 16 КБ. */
function compactDetails(details: Record<string, unknown>): Record<string, unknown> {
  try {
    const json = JSON.stringify(details);
    return json.length <= 8000 ? details : { truncated: true, preview: json.slice(0, 2000) };
  } catch {
    return {};
  }
}

/** Пишет запись; ошибки журнала не должны ломать основное действие. */
export async function logAdminAction(
  client: Client,
  action: AuditAction,
  target = '',
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await client.from('audit_log').insert([{ action, target: target.slice(0, 254), details: compactDetails(details) }]);
  } catch {
    /* журнал вспомогательный */
  }
}

export async function fetchAuditLog(client: Client, limit = 50): Promise<{ entries: AuditEntry[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from('audit_log')
      .select('id, actor_email, action, target, details, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error) return { entries: [], error: error.message };
    const entries = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      actorEmail: typeof row.actor_email === 'string' ? row.actor_email : '',
      action: typeof row.action === 'string' ? row.action : '',
      target: typeof row.target === 'string' ? row.target : '',
      details:
        row.details && typeof row.details === 'object' && !Array.isArray(row.details)
          ? (row.details as Record<string, unknown>)
          : {},
      createdAt: typeof row.created_at === 'string' ? row.created_at : ''
    }));
    return { entries, error: null };
  } catch (err) {
    return { entries: [], error: err instanceof Error ? err.message : 'Не удалось загрузить журнал.' };
  }
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.ban': 'Блокировка пользователя',
  'user.unban': 'Разблокировка пользователя',
  'user.bonus_xp': 'Изменение бонусного XP',
  'user.role': 'Изменение роли',
  'user.delete_profile': 'Удаление профиля',
  'settings.update': 'Изменение настроек сайта',
  'courses.publish': 'Публикация курсов',
  'email.test': 'Тестовое письмо',
  'admin.login': 'Вход в админку',
  'admin.logout': 'Выход из админки',
  'admin.pin_ok': 'ПИН подтверждён',
  'admin.pin_failed': 'Неверный ПИН',
  'admin.pin_changed': 'ПИН изменён'
};
