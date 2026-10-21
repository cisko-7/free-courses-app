/**
 * Отправка писем через EmailJS (почтовый ящик на Яндексе подключён в кабинете EmailJS).
 * Ключи публичные по своей природе: EmailJS ограничивает их по домену (Account → Security → Allowed origins).
 */
import emailjs, { EmailJSResponseStatus } from '@emailjs/browser';

export const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_8xtbnqb';
// Заглушки: подставьте реальные значения в .env.local
export const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_xxxxxxx';
export const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'YOUR_EMAILJS_PUBLIC_KEY';

/** Пауза между повторными отправками письма, сек. */
export const RESEND_COOLDOWN_SEC = 60;

/** Параметры шаблона: имена должны совпадать с {{переменными}} в шаблоне EmailJS. */
export type EmailTemplateParams = Record<string, string>;

export function isEmailJSConfigured(): boolean {
  return !EMAILJS_TEMPLATE_ID.includes('xxxx') && !EMAILJS_PUBLIC_KEY.startsWith('YOUR_');
}

/** Переводит ошибку EmailJS в понятный текст. */
export function translateEmailError(err: unknown): string {
  if (err instanceof EmailJSResponseStatus) {
    if (err.status === 0) return 'Нет связи с почтовым сервисом. Проверьте интернет.';
    if (err.status === 429) return 'Слишком много писем. Подождите немного и повторите.';
    if (err.status === 400 || err.status === 412) return 'Почтовый сервис не настроен (проверьте ключи EmailJS).';
    return `Не удалось отправить письмо (код ${err.status}).`;
  }
  return 'Не удалось отправить письмо. Попробуйте позже.';
}

/** Отправляет письмо по шаблону EmailJS. Бросает исключение при ошибке. */
export async function sendEmailViaEmailJS(templateParams: EmailTemplateParams): Promise<void> {
  if (!isEmailJSConfigured()) {
    throw new Error('EmailJS не настроен: задайте NEXT_PUBLIC_EMAILJS_TEMPLATE_ID и NEXT_PUBLIC_EMAILJS_PUBLIC_KEY.');
  }
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
    publicKey: EMAILJS_PUBLIC_KEY,
    // Не больше одного письма в 10 секунд с одного браузера
    limitRate: { id: 'dc-auth-mail', throttle: 10_000 }
  });
}
