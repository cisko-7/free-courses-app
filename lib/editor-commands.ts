/**
 * Чистые функции IDE-команд редактора кода (без зависимости от Monaco),
 * чтобы их можно было тестировать отдельно от UI.
 */

export type EditorLang = 'cpp' | 'python';

/** Один уровень отступа — 4 пробела (совпадает с tabSize редактора). */
export const INDENT_UNIT = '    ';

/** Маркер однострочного комментария для каждого языка. */
export const LINE_COMMENT: Record<EditorLang, string> = {
  cpp: '//',
  python: '#'
};

const leadingWhitespace = (line: string): string => /^[ \t]*/.exec(line)?.[0] ?? '';

export interface SmartEnterResult {
  /** Текст, который вставляется вместо выделения. */
  text: string;
  /** Сколько пробельных символов сразу после курсора нужно удалить. */
  deleteAfter: number;
  /** Колонка курсора (1-based) на следующей строке после вставки. */
  cursorColumn: number;
}

/**
 * Умный Enter: если текст до курсора заканчивается на `{` (C++) или `:` (Python),
 * новая строка получает текущий отступ + 4 пробела.
 * В C++ для `{|}` закрывающая скобка уходит на отдельную строку с исходным отступом.
 * Возвращает null, если правило не подходит (тогда работает обычный Enter).
 */
export function computeSmartEnter(lang: EditorLang, before: string, after: string): SmartEnterResult | null {
  const trimmedBefore = before.trimEnd();
  // Строка-комментарий не открывает блок
  if (trimmedBefore.trimStart().startsWith(LINE_COMMENT[lang])) return null;

  const opener = lang === 'cpp' ? '{' : ':';
  if (!trimmedBefore.endsWith(opener)) return null;

  const baseIndent = leadingWhitespace(before);
  const innerIndent = baseIndent + INDENT_UNIT;
  const afterTrimmed = after.trimStart();
  const deleteAfter = after.length - afterTrimmed.length;

  const text =
    lang === 'cpp' && afterTrimmed.startsWith('}')
      ? `\n${innerIndent}\n${baseIndent}`
      : `\n${innerIndent}`;

  return { text, deleteAfter, cursorColumn: innerIndent.length + 1 };
}

export interface LineEdit {
  /** Индекс строки внутри переданного массива. */
  lineIndex: number;
  /** Колонка начала правки (1-based). */
  column: number;
  /** Сколько символов удалить начиная с column. */
  deleteLength: number;
  /** Что вставить. */
  insert: string;
}

/**
 * Ctrl + / — переключение комментария для строк.
 * Если все непустые строки закомментированы — снимаем комментарий, иначе комментируем все.
 * Маркер ставится после отступа (`// ` для C++, `# ` для Python).
 */
export function computeToggleComment(lang: EditorLang, lines: readonly string[]): LineEdit[] {
  const token = LINE_COMMENT[lang];
  const nonEmpty = lines
    .map((text, index) => ({ text, index }))
    .filter(({ text }) => text.trim() !== '');

  // Одиночная пустая строка: просто вставляем маркер после отступа
  if (nonEmpty.length === 0) {
    if (lines.length !== 1) return [];
    return [{ lineIndex: 0, column: leadingWhitespace(lines[0]).length + 1, deleteLength: 0, insert: `${token} ` }];
  }

  const allCommented = nonEmpty.every(({ text }) => text.trimStart().startsWith(token));

  if (allCommented) {
    return nonEmpty.map(({ text, index }) => {
      const indent = leadingWhitespace(text).length;
      const rest = text.slice(indent + token.length);
      return {
        lineIndex: index,
        column: indent + 1,
        deleteLength: token.length + (rest.startsWith(' ') ? 1 : 0),
        insert: ''
      };
    });
  }

  // Маркеры выравниваем по минимальному отступу выделенного блока
  const minIndent = Math.min(...nonEmpty.map(({ text }) => leadingWhitespace(text).length));
  return nonEmpty.map(({ index }) => ({
    lineIndex: index,
    column: minIndent + 1,
    deleteLength: 0,
    insert: `${token} `
  }));
}
