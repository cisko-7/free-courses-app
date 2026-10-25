/**
 * Чистые утилиты для авторизации, сессий и синхронизации профиля.
 * Без React и без сетевых вызовов — легко тестировать.
 */
import { isStringArray, isStringRecord } from '@/lib/safe-storage';

// --- ТИПЫ ---

export interface UserAccount {
  email: string;
  display_name: string;
  avatar: string;
  bio: string;
  enrolled_courses: string[];
  completed_items: string[];
  user_code_map: Record<string, string>;
}

/** Локальный прогресс гостя (до входа в аккаунт). */
export type LocalProfile = Omit<UserAccount, 'email'>;

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline-pending' | 'error';
export type PasswordStrength = 'weak' | 'medium' | 'strong';

// --- КОНСТАНТЫ ---

export const MIN_PASSWORD_LENGTH = 8;
/** Флаг: есть несохранённые в облаке изменения (офлайн-очередь). */
export const PENDING_SYNC_KEY = 'dc_pending_sync';
/** Все ключи localStorage с личными данными — стираются при «выйти и очистить». */
export const LOCAL_DATA_KEYS: readonly string[] = [
  'dc_enrolled',
  'dc_completed',
  'dc_code_map',
  'dc_student_name',
  'dc_user_avatar',
  'dc_user_bio',
  PENDING_SYNC_KEY
];

export const DEFAULT_NAME = 'Студент DevCourses';
export const DEFAULT_AVATAR = '👨‍💻';
export const DEFAULT_COURSES: readonly string[] = ['cpp-basics'];

// --- ОШИБКИ ---

const NETWORK_ERROR_RE = /failed to fetch|network|timeout|offline|ECONNREFUSED|load failed/i;

const AUTH_ERROR_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // Маркеры из триггеров БД (supabase/schema.sql)
  [/DC_ACCOUNT_BANNED/, 'Аккаунт заблокирован администратором.'],
  [/DC_READ_ONLY/, 'Сайт временно работает только на чтение: изменения не сохраняются.'],
  [/DC_REGISTRATION_CLOSED/, 'Регистрация новых пользователей временно закрыта.'],
  [/DC_RATE_LIMIT/, 'Слишком много запросов. Подождите и повторите.'],
  // Коды Supabase Auth (signUp отвечает 422 на большинство ошибок валидации)
  [/user_already_exists|email_exists/i, 'Этот Email уже зарегистрирован. Попробуйте войти.'],
  [/weak_password/i, `Пароль слишком простой. Используйте не меньше ${MIN_PASSWORD_LENGTH} символов, буквы и цифры.`],
  [/signup_disabled/i, 'Регистрация новых пользователей временно закрыта.'],
  [/over_email_send_rate_limit/i, 'Слишком много писем за короткое время. Подождите минуту и повторите.'],
  [/invalid login credentials/i, 'Неверный Email или пароль.'],
  [/error sending .*email|email rate limit/i, 'Сервер не смог отправить письмо (лимит или настройки почты). Попробуйте позже.'],
  [/email not confirmed/i, 'Email не подтверждён. Проверьте почту и перейдите по ссылке из письма.'],
  [/user already registered|already been registered/i, 'Этот Email уже зарегистрирован. Попробуйте войти.'],
  [/password should be at least|password.*(short|length)/i, `Пароль слишком короткий (минимум ${MIN_PASSWORD_LENGTH} символов).`],
  [/same.*password|different from the old/i, 'Новый пароль должен отличаться от старого.'],
  [/weak password|pwned/i, 'Пароль слишком простой или найден в утечках. Придумайте другой.'],
  [/rate limit|too many requests|security purposes/i, 'Слишком много попыток. Подождите минуту и повторите.'],
  [/invalid.*email|email address .* is invalid|unable to validate email|email_address_invalid/i, 'Supabase отклонил этот Email. Проверьте адрес или используйте другой.'],
  [/email.*not authorized|email_address_not_authorized/i, 'Supabase разрешает отправку только адресам команды проекта. Выключите «Confirm email» или настройте SMTP.'],
  // Ошибки базы данных (PostgREST): обычно значит, что supabase/schema.sql ещё не выполнен
  [/could not find the .* column|schema cache|relation .* does not exist|PGRST204|PGRST205/i, 'База данных не настроена: выполните supabase/schema.sql в SQL Editor Supabase.'],
  [/no unique or exclusion constraint|ON CONFLICT/i, 'В таблице user_accounts нет уникального email. Выполните supabase/schema.sql.'],
  [/row-level security|permission denied|42501/i, 'Нет прав на запись в базу (RLS). Выполните supabase/schema.sql.'],
  [/violates check constraint|23514/i, 'Данные профиля не прошли проверку (слишком длинное имя, био или код).'],
  [/duplicate key|23505/i, 'Профиль с этим Email уже существует. Попробуйте войти.'],
  [/jwt expired|session.*(missing|expired)|refresh token/i, 'Сессия истекла. Войдите снова.'],
  [/signups not allowed|signup.*disabled/i, 'Регистрация временно отключена.']
];

export function isNetworkError(message: string | null | undefined): boolean {
  return !!message && NETWORK_ERROR_RE.test(message);
}

/** Перевод ошибок Supabase Auth в понятные сообщения на русском. */
export function translateAuthError(message: string | null | undefined): string {
  if (!message) return 'Неизвестная ошибка. Попробуйте ещё раз.';
  if (isNetworkError(message)) return 'Нет связи с сервером. Проверьте интернет и повторите.';
  for (const [re, text] of AUTH_ERROR_RULES) {
    if (re.test(message)) return text;
  }
  // Показываем исходный текст: без него ошибку 400 невозможно диагностировать
  return `Не удалось выполнить операцию: ${message.slice(0, 200)}`;
}

// --- ВАЛИДАЦИЯ ---

/** Оценка надёжности пароля по длине и разнообразию символов. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return 'weak';
  let classes = 0;
  if (/[a-zа-яё]/.test(password)) classes++;
  if (/[A-ZА-ЯЁ]/.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^\p{L}\d]/u.test(password)) classes++;
  if (password.length >= 12 && classes >= 3) return 'strong';
  if (classes >= 2) return 'medium';
  return 'weak';
}

/** Ошибка валидации нового пароля (или null, если всё в порядке). */
export function validateNewPassword(password: string, confirm?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль слишком короткий (минимум ${MIN_PASSWORD_LENGTH} символов).`;
  }
  if (password.length > 72) return 'Пароль слишком длинный (максимум 72 символа).';
  if (confirm !== undefined && password !== confirm) return 'Пароли не совпадают.';
  return null;
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// --- ПРОФИЛИ И СЛИЯНИЕ ---

/**
 * Создать локальный профиль гостя (до входа в аккаунт).
 */
export function createGuestProfile(
  displayName: string,
  enrolledCourses: string[],
  completedItems: string[],
  userCodeMap: Record<string, string>,
  avatar: string = DEFAULT_AVATAR,
  bio: string = ''
): LocalProfile {
  return {
    display_name: displayName || DEFAULT_NAME,
    avatar: avatar || DEFAULT_AVATAR,
    bio: bio || '',
    enrolled_courses: enrolledCourses || [...DEFAULT_COURSES],
    completed_items: completedItems || [],
    user_code_map: userCodeMap || {}
  };
}

/**
 * Распарсить и валидировать строку из Supabase таблицы user_accounts.
 * Подставляет безопасные значения по умолчанию для битых данных.
 */
export function parseCloudAccount(
  row: unknown
): UserAccount {
  if (typeof row !== 'object' || row === null) {
    throw new Error('Invalid row: not an object');
  }

  const r = row as Record<string, unknown>;
  if (typeof r.email !== 'string' || !r.email) {
    throw new Error('Missing email');
  }

  return {
    email: r.email,
    display_name: typeof r.display_name === 'string' ? r.display_name : DEFAULT_NAME,
    avatar: typeof r.avatar === 'string' ? r.avatar : DEFAULT_AVATAR,
    bio: typeof r.bio === 'string' ? r.bio : '',
    enrolled_courses: isStringArray(r.enrolled_courses) ? r.enrolled_courses : [...DEFAULT_COURSES],
    completed_items: isStringArray(r.completed_items) ? r.completed_items : [],
    user_code_map: isStringRecord(r.user_code_map) ? r.user_code_map : {}
  };
}

/**
 * Умное слияние локального прогресса гостя с облачным аккаунтом.
 * Приоритеты:
 *   - Текстовые поля (имя, аватар, био): облако выигрывает (мнение пользователя).
 *   - Массивы прогресса: объединяем всё уникальное (не теряем работу).
 */
export function mergeGuestToCloud(local: LocalProfile, cloud: UserAccount): UserAccount {
  // Объединение курсов: берём все уникальные, сортируем
  const enrolledSet = new Set([...local.enrolled_courses, ...cloud.enrolled_courses]);
  const mergedEnrolled = Array.from(enrolledSet).sort();

  // Объединение выполненных уроков
  const completedSet = new Set([...local.completed_items, ...cloud.completed_items]);
  const mergedCompleted = Array.from(completedSet).sort();

  // Слияние кодов: облако перезаписывает локальное (облако — источник истины)
  const mergedCodeMap = { ...local.user_code_map, ...cloud.user_code_map };

  return {
    email: cloud.email,
    display_name: cloud.display_name,
    avatar: cloud.avatar,
    bio: cloud.bio,
    enrolled_courses: mergedEnrolled,
    completed_items: mergedCompleted,
    user_code_map: mergedCodeMap
  };
}
