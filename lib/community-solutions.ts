/**
 * «Решения других студентов» (Community Solutions).
 *
 * Источники данных (объединяются в одну ленту):
 *  1. Облачная таблица Supabase `task_solutions`;
 *  2. Локальный кэш localStorage `dc_community_solutions` (работает офлайн).
 * Показываются только реальные решения студентов: пока их нет, лента пустая.
 *
 * Ожидаемая схема таблицы (Supabase SQL Editor):
 *
 *   create table public.task_solutions (
 *     id bigint generated always as identity primary key,
 *     task_id text not null,
 *     course_id text not null,
 *     language text not null,
 *     author_name text not null,
 *     author_avatar text not null default '👨‍💻',
 *     author_rank text not null default 'Новичок',
 *     code text not null check (char_length(code) <= 30000),
 *     lines_count int not null default 0,
 *     likes_count int not null default 0,
 *     created_at timestamptz not null default now()
 *   );
 *   create index on public.task_solutions (task_id);
 *   alter table public.task_solutions enable row level security;
 *   create policy "read"   on public.task_solutions for select using (true);
 *   create policy "insert" on public.task_solutions for insert with check (true);
 *   -- ВНИМАНИЕ: такая политика update разрешает любому менять любые строки.
 *   -- Для продакшена добавьте user_id = auth.uid() и RPC для инкремента лайков.
 *   create policy "update" on public.task_solutions for update using (true);
 *
 * Все запросы к Supabase обёрнуты в try/catch и ничего не пишут в консоль:
 * без таблицы или сети работает локальный кэш.
 */

import { supabase } from '@/lib/supabase';
import { readJSON, safeSet } from '@/lib/safe-storage';

// --- ТИПЫ ---

export type SolutionSource = 'cloud' | 'local';
export type SolutionSort = 'popular' | 'shortest' | 'newest';

export interface CommunitySolution {
  id: string;
  task_id: string;
  course_id: string;
  language: string;
  author_name: string;
  author_avatar: string;
  author_rank: string;
  code: string;
  lines_count: number;
  likes_count: number;
  /** ISO-дата публикации */
  created_at: string;
  source: SolutionSource;
  /** Решение текущего пользователя (флаг хранится только локально) */
  is_own?: boolean;
  /** Последняя версия сохранена только локально и ещё не дошла до облака */
  pending_sync?: boolean;
}

export interface PublishInput {
  taskId: string;
  courseId: string;
  language: string;
  authorName: string;
  authorAvatar: string;
  authorRank: string;
  code: string;
}

export interface PublishResult {
  solution: CommunitySolution;
  /** true, если запись сохранена в Supabase; false, если только локально */
  syncedToCloud: boolean;
}

/** Колонки, которые клиент пишет в task_solutions */
interface SolutionRow {
  task_id: string;
  course_id: string;
  language: string;
  author_name: string;
  author_avatar: string;
  author_rank: string;
  code: string;
  lines_count: number;
}

// --- КОНСТАНТЫ ---

export const COMMUNITY_SOLUTIONS_KEY = 'dc_community_solutions';
export const LIKED_SOLUTIONS_KEY = 'dc_liked_solutions';
const TABLE = 'task_solutions';
const CLOUD_LIMIT = 20;
const MAX_CODE_LENGTH = 30000;
const CLOUD_COLUMNS =
  'id, task_id, course_id, language, author_name, author_avatar, author_rank, code, lines_count, likes_count, created_at';

// --- МЕТРИКИ КОДА ---

export function countLines(code: string): number {
  const trimmed = code.trim();
  return trimmed ? trimmed.split(/\r?\n/).length : 0;
}

export function countChars(code: string): number {
  return code.trim().length;
}

/** Нормализация для сравнения кода: \r\n → \n, без хвостовых пробелов. */
function normalizeCode(code: string): string {
  return code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

export function isSameCode(a: string, b: string): boolean {
  return normalizeCode(a) === normalizeCode(b);
}

// --- ПРОВЕРКИ СТРУКТУРЫ ---

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const SOLUTION_STRING_FIELDS = [
  'id',
  'task_id',
  'course_id',
  'language',
  'author_name',
  'author_avatar',
  'author_rank',
  'code',
  'created_at'
] as const;

function isCommunitySolution(v: unknown): v is CommunitySolution {
  if (!isRecord(v)) return false;
  return (
    SOLUTION_STRING_FIELDS.every((k) => typeof v[k] === 'string') &&
    typeof v.lines_count === 'number' &&
    typeof v.likes_count === 'number' &&
    (v.source === 'cloud' || v.source === 'local') &&
    (v.is_own === undefined || typeof v.is_own === 'boolean') &&
    (v.pending_sync === undefined || typeof v.pending_sync === 'boolean')
  );
}

const isSolutionCache = (v: unknown): v is Record<string, CommunitySolution[]> =>
  isRecord(v) && Object.values(v).every((list) => Array.isArray(list) && list.every(isCommunitySolution));

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

const rowId = (v: unknown): string | null =>
  typeof v === 'number' || (typeof v === 'string' && v !== '') ? String(v) : null;

/** Разбор строки из Supabase (null, если строка битая). Длины полей ограничены. */
function parseCloudRow(row: unknown): CommunitySolution | null {
  if (!isRecord(row)) return null;
  const id = rowId(row.id);
  const code = typeof row.code === 'string' ? row.code.slice(0, MAX_CODE_LENGTH) : '';
  if (!id || !code.trim() || typeof row.task_id !== 'string') return null;
  const str = (k: string, fallback: string, max: number): string => {
    const value = row[k];
    return typeof value === 'string' && value.trim() ? value.slice(0, max) : fallback;
  };
  const likes = typeof row.likes_count === 'number' && Number.isFinite(row.likes_count) ? row.likes_count : 0;
  const created = str('created_at', new Date(0).toISOString(), 40);
  return {
    id,
    task_id: row.task_id,
    course_id: str('course_id', '', 80),
    language: str('language', '', 40),
    author_name: str('author_name', 'Студент', 80),
    author_avatar: str('author_avatar', '👨‍💻', 16),
    author_rank: str('author_rank', 'Новичок', 40),
    code,
    // lines_count пересчитываем сами, чтобы сортировка «самые короткие» была честной
    lines_count: countLines(code),
    likes_count: Math.max(0, Math.floor(likes)),
    created_at: Number.isNaN(Date.parse(created)) ? new Date(0).toISOString() : created,
    source: 'cloud'
  };
}

// --- ЛОКАЛЬНЫЙ КЭШ (localStorage) ---

export function readSolutionCache(): Record<string, CommunitySolution[]> {
  return readJSON(COMMUNITY_SOLUTIONS_KEY, isSolutionCache) ?? {};
}

function writeSolutionCache(cache: Record<string, CommunitySolution[]>): void {
  safeSet(COMMUNITY_SOLUTIONS_KEY, JSON.stringify(cache));
}

export function getLocalSolutions(taskId: string): CommunitySolution[] {
  return readSolutionCache()[taskId] ?? [];
}

export function getOwnSolution(taskId: string): CommunitySolution | null {
  return getLocalSolutions(taskId).find((s) => s.is_own) ?? null;
}

/** Этот код уже опубликован в облаке — повторная публикация не нужна. */
export function isOwnSynced(own: CommunitySolution | null, code: string): boolean {
  return !!own && own.source === 'cloud' && !own.pending_sync && isSameCode(own.code, code);
}

/** Сохраняет своё решение в кэш: у пользователя одна запись на задачу. */
function saveOwnLocal(solution: CommunitySolution): void {
  const cache = readSolutionCache();
  const others = (cache[solution.task_id] ?? []).filter((s) => !s.is_own && s.id !== solution.id);
  cache[solution.task_id] = [{ ...solution, is_own: true }, ...others];
  writeSolutionCache(cache);
}

export function readLikedIds(): string[] {
  return readJSON(LIKED_SOLUTIONS_KEY, isStringList) ?? [];
}

function writeLikedIds(ids: string[]): void {
  safeSet(LIKED_SOLUTIONS_KEY, JSON.stringify(ids));
}

// --- SUPABASE (всё в try/catch: без таблицы или сети возвращаем пустой результат) ---

export async function fetchCloudSolutions(taskId: string): Promise<CommunitySolution[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CLOUD_COLUMNS)
      .eq('task_id', taskId)
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(CLOUD_LIMIT);
    if (error || !Array.isArray(data)) return [];
    const rows: unknown[] = data;
    return rows.map(parseCloudRow).filter((s): s is CommunitySolution => s !== null);
  } catch {
    return [];
  }
}

/** id облачной записи этого автора с тем же кодом (защита от дубликатов). */
async function findCloudDuplicate(row: SolutionRow): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .eq('task_id', row.task_id)
      .eq('author_name', row.author_name)
      .eq('code', row.code)
      .limit(1);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const first: unknown = data[0];
    return isRecord(first) ? rowId(first.id) : null;
  } catch {
    return null;
  }
}

/** Обновляет запись по id; null при ошибке или если RLS не дал обновить. */
async function updateCloudRow(
  id: string,
  patch: Partial<SolutionRow> & { likes_count?: number }
): Promise<CommunitySolution | null> {
  try {
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select(CLOUD_COLUMNS);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return parseCloudRow(data[0]);
  } catch {
    return null;
  }
}

async function insertCloudRow(row: SolutionRow): Promise<CommunitySolution | null> {
  try {
    const { data, error } = await supabase.from(TABLE).insert([row]).select(CLOUD_COLUMNS).single();
    if (error) return null;
    return parseCloudRow(data);
  } catch {
    return null;
  }
}

/**
 * Публикует решение: в localStorage и в Supabase.
 * Без дубликатов: если у пользователя уже есть облачная запись по задаче (из кэша)
 * или в облаке найден тот же автор с тем же кодом, запись обновляется.
 */
export async function publishSolution(input: PublishInput): Promise<PublishResult> {
  const code = input.code.trim().slice(0, MAX_CODE_LENGTH);
  const previous = getOwnSolution(input.taskId);
  const row: SolutionRow = {
    task_id: input.taskId,
    course_id: input.courseId,
    language: input.language,
    author_name: input.authorName.trim().slice(0, 80) || 'Студент',
    author_avatar: input.authorAvatar,
    author_rank: input.authorRank,
    code,
    lines_count: countLines(code)
  };

  const knownCloudId = previous?.source === 'cloud' ? previous.id : null;
  let cloud: CommunitySolution | null = knownCloudId ? await updateCloudRow(knownCloudId, row) : null;
  if (!cloud) {
    const duplicateId = await findCloudDuplicate(row);
    cloud = duplicateId ? await updateCloudRow(duplicateId, row) : await insertCloudRow(row);
  }

  const solution: CommunitySolution = cloud
    ? { ...cloud, is_own: true }
    : {
        // Офлайн: храним локально, облачный id (если был) сохраняем, чтобы потом обновить ту же запись
        id: previous?.id ?? `local-${input.taskId}-${Date.now().toString(36)}`,
        ...row,
        likes_count: previous?.likes_count ?? 0,
        created_at: new Date().toISOString(),
        source: previous?.source === 'cloud' ? 'cloud' : 'local',
        is_own: true,
        pending_sync: true
      };

  saveOwnLocal(solution);
  return { solution, syncedToCloud: cloud !== null };
}

/**
 * Переключает лайк: ID в localStorage, likes_count в кэше и (для облачных записей) в Supabase.
 * Инкремент в облаке не атомарный; для продакшена лучше RPC.
 */
export async function toggleLike(solution: CommunitySolution): Promise<{ liked: boolean; likes: number }> {
  const likedIds = readLikedIds();
  const wasLiked = likedIds.includes(solution.id);
  writeLikedIds(wasLiked ? likedIds.filter((id) => id !== solution.id) : [...likedIds, solution.id]);
  const likes = Math.max(0, solution.likes_count + (wasLiked ? -1 : 1));

  const cache = readSolutionCache();
  const list = cache[solution.task_id];
  if (list?.some((s) => s.id === solution.id)) {
    cache[solution.task_id] = list.map((s) => (s.id === solution.id ? { ...s, likes_count: likes } : s));
    writeSolutionCache(cache);
  }

  if (solution.source === 'cloud' && !solution.id.startsWith('local-')) {
    await updateCloudRow(solution.id, { likes_count: likes });
  }
  return { liked: !wasLiked, likes };
}

// --- ОБЪЕДИНЕНИЕ И СОРТИРОВКА ---

/**
 * Итоговая лента: своё решение → облако → прочий кэш.
 * Дубликаты (по id или по паре «автор + код») отбрасываются.
 */
export function mergeSolutions(local: CommunitySolution[], cloud: CommunitySolution[]): CommunitySolution[] {
  const result: CommunitySolution[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const own = local.filter((s) => s.is_own);
  const ownIds = new Set(own.map((s) => s.id));
  const cloudById = new Map(cloud.map((s) => [s.id, s]));

  const push = (s: CommunitySolution) => {
    const key = `${s.author_name}\u0000${normalizeCode(s.code)}`;
    if (seenIds.has(s.id) || seenKeys.has(key)) return;
    seenIds.add(s.id);
    seenKeys.add(key);
    result.push(s);
  };

  own.forEach((s) => {
    const fromCloud = cloudById.get(s.id);
    // Код берём локальный (мог обновиться офлайн), лайки — из облака
    push(fromCloud ? { ...s, likes_count: fromCloud.likes_count, is_own: true } : s);
  });
  cloud.forEach((s) => push(ownIds.has(s.id) ? { ...s, is_own: true } : s));
  local.filter((s) => !s.is_own).forEach(push);
  return result;
}

export function sortSolutions(list: CommunitySolution[], sort: SolutionSort): CommunitySolution[] {
  const byDate = (a: CommunitySolution, b: CommunitySolution) => Date.parse(b.created_at) - Date.parse(a.created_at);
  const copy = [...list];
  if (sort === 'popular') return copy.sort((a, b) => b.likes_count - a.likes_count || byDate(a, b));
  if (sort === 'shortest') {
    return copy.sort((a, b) => a.lines_count - b.lines_count || countChars(a.code) - countChars(b.code));
  }
  return copy.sort(byDate);
}

/** «только что», «5 минут назад», «3 дня назад». */
export function formatRelativeTime(iso: string, now: number): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.round((ts - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return 'только что';
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

/** Склонение: 1 строка, 2 строки, 5 строк. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
