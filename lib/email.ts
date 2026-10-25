/**
 * Отправка писем через EmailJS (почтовый ящик подключён в кабинете EmailJS).
 * Ключи публичные по своей природе и попадают в бандл: EmailJS ограничивает их по домену
 * (Account → Security → Allowed origins). Значения задаются при сборке через NEXT_PUBLIC_EMAILJS_*:
 * локально — в .env.local, в GitHub Actions — в env шага сборки (Settings → Variables).
 */
import emailjs, { EmailJSResponseStatus } from '@emailjs/browser';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCooldown, sanitizeUrl } from '@/lib/security';

export const EMAILJS_SERVICE_ID = (process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_8xtbnqb').trim();
export const EMAILJS_TEMPLATE_ID = (process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '').trim();
export const EMAILJS_PUBLIC_KEY = (process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '').trim();

/** Пауза между повторными отправками письма, сек. */
export const RESEND_COOLDOWN_SEC = 60;

/** Параметры шаблона: имена должны совпадать с {{переменными}} в шаблоне EmailJS. */
export type EmailTemplateParams = Record<string, string>;

// Пустые значения и старые заглушки из исходников: с ними EmailJS всегда отвечает 400
const PLACEHOLDER_RE = /x{4,}|^YOUR_|^$/i;

export function isEmailJSConfigured(): boolean {
  return [EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY].every((v) => !PLACEHOLDER_RE.test(v));
}

/** Какие переменные не заданы — для подсказки в админке. */
export function missingEmailJSKeys(): string[] {
  const keys: Array<[string, string]> = [
    ['NEXT_PUBLIC_EMAILJS_SERVICE_ID', EMAILJS_SERVICE_ID],
    ['NEXT_PUBLIC_EMAILJS_TEMPLATE_ID', EMAILJS_TEMPLATE_ID],
    ['NEXT_PUBLIC_EMAILJS_PUBLIC_KEY', EMAILJS_PUBLIC_KEY]
  ];
  return keys.filter(([, v]) => PLACEHOLDER_RE.test(v)).map(([k]) => k);
}

/**
 * Ошибка EmailJS одной строкой для логов и журнала.
 * EmailJS бросает EmailJSResponseStatus ({ status, text }), а не Error,
 * поэтому `console.error(err)` раньше показывал пустой объект `{}`.
 */
export function serializeEmailError(err: unknown): string {
  if (err instanceof EmailJSResponseStatus) return `EmailJS ${err.status}: ${err.text || 'без описания'}`;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const r = err as Record<string, unknown>;
    if ('status' in r || 'text' in r) return `EmailJS ${String(r.status ?? '?')}: ${String(r.text ?? '')}`;
    try {
      return JSON.stringify(err).slice(0, 500);
    } catch {
      return 'Неизвестная ошибка';
    }
  }
  return String(err);
}

function errorStatus(err: unknown): number | null {
  if (err instanceof EmailJSResponseStatus) return err.status;
  const status = err && typeof err === 'object' ? (err as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? status : null;
}

/** Переводит ошибку EmailJS в понятный текст. */
export function translateEmailError(err: unknown): string {
  const status = errorStatus(err);
  const text = serializeEmailError(err);
  if (status === 0 || /network|failed to fetch/i.test(text)) return 'Нет связи с почтовым сервисом. Проверьте интернет.';
  if (status === 429 || /rate|throttl/i.test(text)) return 'Слишком много писем. Подождите минуту и повторите.';
  if (status === 400 && /public key|user id/i.test(text)) return 'Неверный Public Key EmailJS (NEXT_PUBLIC_EMAILJS_PUBLIC_KEY).';
  if (status === 400 && /template/i.test(text)) return 'Шаблон EmailJS не найден (NEXT_PUBLIC_EMAILJS_TEMPLATE_ID).';
  if (status === 400 && /service/i.test(text)) return 'Сервис EmailJS не найден (NEXT_PUBLIC_EMAILJS_SERVICE_ID).';
  if (status === 403 || /origin|domain/i.test(text)) return 'Домен сайта не разрешён в EmailJS (Account → Security).';
  if (status === 412 || /gmail|oauth|reconnect/i.test(text)) return 'Почтовый ящик в EmailJS отключён: переподключите его.';
  if (status !== null) return `Не удалось отправить письмо (код ${status}).`;
  if (/не настроен|будет доступна/i.test(text)) return text;
  return 'Не удалось отправить письмо. Попробуйте позже.';
}

// Один кулдаун на вкладку: защищает от двойных кликов и спама с одного браузера
const sendCooldown = createCooldown(RESEND_COOLDOWN_SEC * 1000);

/** Сколько секунд осталось до следующей отправки (0 — можно). */
export function emailCooldownLeftSec(): number {
  return Math.ceil(sendCooldown.remainingMs() / 1000);
}

/** Отправляет письмо по шаблону EmailJS. Бросает исключение при ошибке. */
export async function sendEmailViaEmailJS(
  templateParams: EmailTemplateParams,
  options: { ignoreCooldown?: boolean } = {}
): Promise<void> {
  if (!isEmailJSConfigured()) {
    throw new Error(`EmailJS не настроен: задайте ${missingEmailJSKeys().join(', ')}.`);
  }
  if (!options.ignoreCooldown && !sendCooldown.isReady()) {
    throw new Error(`Повторная отправка будет доступна через ${emailCooldownLeftSec()} с.`);
  }
  const params = { ...templateParams };
  // Ссылка в письме — только http(s), иначе адрес сайта
  if ('link' in params) {
    params.link = sanitizeUrl(params.link) || (typeof window !== 'undefined' ? window.location.origin : '');
  }
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, {
    publicKey: EMAILJS_PUBLIC_KEY,
    // Не больше одного письма в 10 секунд с одного браузера (защита на стороне SDK)
    limitRate: { id: 'dc-auth-mail', throttle: 10_000 }
  });
  sendCooldown.trigger();
}

type Client = Pick<SupabaseClient, 'from'>;

/** Пишет результат отправки в email_logs (ошибки журнала игнорируются). */
export async function logEmail(
  client: Client,
  entry: { recipient: string; template: string; status: 'sent' | 'failed'; error?: string }
): Promise<void> {
  try {
    await client.from('email_logs').insert([
      {
        recipient: entry.recipient.trim().toLowerCase().slice(0, 254),
        template: entry.template.slice(0, 64),
        status: entry.status,
        error: (entry.error ?? '').slice(0, 1000)
      }
    ]);
  } catch {
    /* журнал вспомогательный */
  }
}

/** Отправка + запись в журнал. Возвращает null при успехе или понятный текст ошибки. */
export async function sendAndLogEmail(
  client: Client,
  recipient: string,
  params: EmailTemplateParams,
  template = 'confirmation',
  options: { ignoreCooldown?: boolean } = {}
): Promise<string | null> {
  try {
    await sendEmailViaEmailJS(params, options);
    void logEmail(client, { recipient, template, status: 'sent' });
    return null;
  } catch (err) {
    const raw = serializeEmailError(err);
    console.error('EmailJS send failed:', raw);
    void logEmail(client, { recipient, template, status: 'failed', error: raw });
    return translateEmailError(err);
  }
}

/** Тестовое письмо из админки (кулдаун пользователя не тратит). */
export function sendTestEmail(client: Client, recipient: string): Promise<string | null> {
  return sendAndLogEmail(
    client,
    recipient,
    {
      user_email: recipient,
      user_name: 'Администратор',
      link: typeof window !== 'undefined' ? window.location.origin : ''
    },
    'test',
    { ignoreCooldown: true }
  );
}

export interface EmailLogEntry {
  id: number;
  recipient: string;
  template: string;
  status: 'sent' | 'failed';
  error: string;
  createdAt: string;
}

/** Последние записи журнала писем (только для администратора — RLS). */
export async function fetchEmailLogs(
  client: Client,
  limit = 50
): Promise<{ entries: EmailLogEntry[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from('email_logs')
      .select('id, recipient, template, status, error, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error) return { entries: [], error: error.message };
    const entries = (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      recipient: String(row.recipient ?? ''),
      template: String(row.template ?? ''),
      status: row.status === 'sent' ? ('sent' as const) : ('failed' as const),
      error: String(row.error ?? ''),
      createdAt: String(row.created_at ?? '')
    }));
    return { entries, error: null };
  } catch (err) {
    return { entries: [], error: err instanceof Error ? err.message : 'Не удалось загрузить журнал писем.' };
  }
}
