/**
 * Безопасная работа с localStorage.
 * localStorage может бросать исключения (режим инкогнито, запрет cookies, переполнение)
 * и содержать мусор или данные, изменённые пользователем в DevTools,
 * поэтому всё читаем в try/catch и проверяем структуру перед использованием.
 */

export function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Читает JSON и возвращает значение, только если оно прошло проверку guard. */
export function readJSON<T>(key: string, guard: (v: unknown) => v is T): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// --- Проверки структуры ---

export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

export const isStringRecord = (v: unknown): v is Record<string, string> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");

/** Лёгкая структурная проверка курса (поля, нужные для отрисовки). */
export function isCourseShape(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  const strings = ["id", "title", "language", "level", "duration", "accent", "badgeBg", "description"];
  if (!strings.every((k) => typeof c[k] === "string")) return false;
  if (c.langKey !== "cpp" && c.langKey !== "python") return false;
  if (!Array.isArray(c.modules) || c.modules.length === 0) return false;
  return c.modules.every((m) => {
    const mod = m as Record<string, unknown> | null;
    return (
      !!mod &&
      typeof mod.id === "string" &&
      typeof mod.title === "string" &&
      Array.isArray(mod.items) &&
      mod.items.every((i) => {
        const it = i as Record<string, unknown> | null;
        return (
          !!it &&
          typeof it.id === "string" &&
          typeof it.title === "string" &&
          typeof it.content === "string" &&
          (it.type === "theory" || it.type === "task" || it.type === "quiz")
        );
      })
    );
  });
}

export const isCourseList = (v: unknown): v is unknown[] =>
  Array.isArray(v) && v.length > 0 && v.every(isCourseShape);
