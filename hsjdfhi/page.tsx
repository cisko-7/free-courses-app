"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  readJSON,
  safeGet,
  safeSet,
  safeRemove,
  isStringArray,
  isStringRecord,
  isCourseList
} from '@/lib/safe-storage';
import {
  Code2,
  BookOpen,
  Terminal,
  CheckCircle2,
  Play,
  Award,
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Download,
  Unlock,
  Layers,
  Cpu,
  FileCode,
  ArrowRight,
  Menu,
  X,
  Eye,
  EyeOff,
  Trophy,
  Flame,
  GraduationCap,
  AlertCircle,
  Settings,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Cloud,
  Save,
  LayoutDashboard,
  Compass
} from 'lucide-react';

// --- ТИПЫ ДАННЫХ TYPESCRIPT ---

export interface TestCase {
  input: string;
  expected: string;
}

export interface CourseItem {
  id: string;
  title: string;
  type: 'theory' | 'task';
  content: string;
  initialCode?: string;
  solution?: string;
  tests?: TestCase[];
}

export interface FlatCourseItem extends CourseItem {
  moduleId: string;
  moduleTitle: string;
}

export interface CourseModule {
  id: string;
  title: string;
  items: CourseItem[];
}

export interface Course {
  id: string;
  title: string;
  language: string;
  langKey: 'cpp' | 'python';
  level: string;
  duration: string;
  accent: string;
  badgeBg: string;
  description: string;
  skills?: string[];
  modules: CourseModule[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  engine: string;
}

export interface TestResult {
  index: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  engine: string;
}

export interface UserAccount {
  email: string;
  display_name: string;
  avatar: string;
  bio: string;
  enrolled_courses: string[];
  completed_items: string[];
  user_code_map: Record<string, string>;
}

type TabType =
  | 'dashboard'
  | 'catalog'
  | 'my-learning'
  | 'certificates'
  | 'profile'
  | 'learn'
  | 'certificate';

const AVATAR_OPTIONS: string[] = ['👨‍💻', '🚀', '⚡', '🤖', '🦊', '🔥', '💎', '🎓'];

// Кнопка «Демо» (открывает все уроки) доступна только в разработке или при NEXT_PUBLIC_DEMO_MODE=true
const IS_DEMO_MODE = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Адрес сервера проверки кода (Supabase Edge Function или свой сервер). Сайт статический,
// поэтому /api/run недоступен — адрес задаётся при сборке через NEXT_PUBLIC_RUN_URL.
const RUN_URL = process.env.NEXT_PUBLIC_RUN_URL ?? '';

// Максимальная длина решения, отправляемого на проверку
const MAX_CODE_LENGTH = 30000;

function courseStats(course: Course) {
  let lessons = 0;
  let tasks = 0;
  course.modules.forEach((m) =>
    m.items.forEach((i) => {
      lessons += 1;
      if (i.type === 'task') tasks += 1;
    })
  );
  return { modules: course.modules.length, lessons, tasks };
}

// --- СТАНДАРТНАЯ БАЗА КУРСОВ ---

const COURSES_DATA: Course[] = [
  {
    id: 'cpp-basics',
    title: 'C++: С нуля до первого проекта',
    language: 'C++',
    langKey: 'cpp',
    level: 'Начинающий',
    duration: '14 часов',
    accent: 'from-blue-600 to-cyan-500',
    badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    description:
      'Фундаментальный практический курс по современному C++ (C++17/20). Потоки ввода-вывода, управление памятью, динамические массивы std::vector и алгоритмические задачи.',
    skills: ['Синтаксис C++17', 'Потоки iostream', 'std::vector', 'Алгоритмы'],
    modules: [
      {
        id: 'cpp-mod-1',
        title: 'Модуль 1. Основы синтаксиса C++',
        items: [
          {
            id: 'cpp-1-theory',
            title: 'Структура программы, iostream и переменные',
            type: 'theory',
            content: `# Введение в современный C++

Язык **C++** — это компилируемый, строго типизированный язык программирования общего назначения.

### 1. Минимальная структура программы

Каждая программа на C++ начинается с функции \`main()\`. Для работы со стандартным вводом и выводом подключается \`<iostream>\`:

\`\`\`cpp
#include <iostream>

int main() {
    std::cout << "Привет, мир C++!" << std::endl;
    return 0;
}
\`\`\`

### 2. Ввод и вывод данных (std::cin и std::cout)

\`\`\`cpp
#include <iostream>

int main() {
    int a, b;
    std::cin >> a >> b;
    std::cout << "Сумма: " << (a + b) << "\\n";
    return 0;
}
\`\`\`

> **Совет:** Используйте \`"\\n"\` вместо \`std::endl\`, чтобы ускорить вывод данных.`
          },
          {
            id: 'cpp-1-task-1',
            title: 'Задача: Сумма двух чисел',
            type: 'task',
            content: `# Задача: Сумма двух чисел

Напишите программу на **C++**, которая считывает из \`std::cin\` два целых числа $A$ и $B$, а затем выводит их сумму в \`std::cout\`.`,
            initialCode: `#include <iostream>\n\nint main() {\n    int a, b;\n    // Считайте числа a и b и выведите их сумму\n    \n    return 0;\n}`,
            solution: `#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) {\n        std::cout << (a + b) << "\\n";\n    }\n    return 0;\n}`,
            tests: [
              { input: '2 3', expected: '5' },
              { input: '10 -4', expected: '6' },
              { input: '100 250', expected: '350' }
            ]
          },
          {
            id: 'cpp-1-task-2',
            title: 'Задача: Чётное или нечётное',
            type: 'task',
            content: `# Задача: Чётное или нечётное

Дано одно целое число $N$. Если число делится на 2 без остатка (\`n % 2 == 0\`), выведите \`EVEN\`, иначе \`ODD\`.`,
            initialCode: `#include <iostream>\n\nint main() {\n    int n;\n    std::cin >> n;\n    // Напишите проверку чётности ниже:\n    \n    return 0;\n}`,
            solution: `#include <iostream>\n\nint main() {\n    int n;\n    if (std::cin >> n) {\n        if (n % 2 == 0) std::cout << "EVEN\\n";\n        else std::cout << "ODD\\n";\n    }\n    return 0;\n}`,
            tests: [
              { input: '4', expected: 'EVEN' },
              { input: '7', expected: 'ODD' },
              { input: '0', expected: 'EVEN' }
            ]
          }
        ]
      },
      {
        id: 'cpp-mod-2',
        title: 'Модуль 2. Массивы, std::vector и матрицы',
        items: [
          {
            id: 'cpp-2-theory',
            title: 'Динамические массивы std::vector',
            type: 'theory',
            content: `# Массивы и std::vector в C++

В современном C++ вместо сырых массивов используется динамический контейнер \`std::vector\` из библиотеки \`<vector>\`.

\`\`\`cpp
#include <iostream>
#include <vector>

int main() {
    std::vector<int> nums = {10, 20, 30};
    nums.push_back(40);

    for (size_t i = 0; i < nums.size(); ++i) {
        std::cout << nums[i] << " ";
    }
    return 0;
}
\`\`\``
          },
          {
            id: 'cpp-2-task-1',
            title: 'Задача: Максимум в массиве',
            type: 'task',
            content: `# Задача: Максимум в массиве

В первой строке вводится число $N$, во второй — $N$ целых чисел. Выведите максимальный элемент массива.`,
            initialCode: `#include <iostream>\n#include <vector>\n\nint main() {\n    int n;\n    if (!(std::cin >> n)) return 0;\n    std::vector<int> a(n);\n    for (int i = 0; i < n; ++i) std::cin >> a[i];\n    \n    // Найдите и выведите максимум:\n    \n    return 0;\n}`,
            solution: `#include <iostream>\n#include <vector>\n\nint main() {\n    int n;\n    if (!(std::cin >> n)) return 0;\n    std::vector<int> a(n);\n    for (int i = 0; i < n; ++i) std::cin >> a[i];\n    int max_val = a[0];\n    for (int i = 1; i < n; ++i) {\n        if (a[i] > max_val) max_val = a[i];\n    }\n    std::cout << max_val << "\\n";\n    return 0;\n}`,
            tests: [
              { input: '5\n1 9 3 7 2', expected: '9' },
              { input: '3\n-5 -2 -10', expected: '-2' },
              { input: '4\n42 42 10 0', expected: '42' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'python-basics',
    title: 'Python: Основы, алгоритмы и скрипты',
    language: 'Python',
    langKey: 'python',
    level: 'Начинающий',
    duration: '12 часов',
    accent: 'from-amber-500 to-yellow-400',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    description:
      'Практический старт в Python 3: чистый синтаксис, динамическая типизация, f-строки, списковые включения и написание функций.',
    skills: ['Python 3', 'f-строки', 'Списки (Lists)', 'Функции'],
    modules: [
      {
        id: 'py-mod-1',
        title: 'Модуль 1. Быстрый старт в Python',
        items: [
          {
            id: 'py-1-theory',
            title: 'Переменные, f-строки и условия',
            type: 'theory',
            content: `# Основы языка Python

\`\`\`python
name = "Кирилл"
age = 18
print(f"Привет, я {name}, мне {age} лет.")
\`\`\``
          },
          {
            id: 'py-1-task-1',
            title: 'Задача: Приветствие разработчика',
            type: 'task',
            content: `# Задача: Приветствие разработчика

Считайте имя пользователя через \`input()\` и выведите: \`Привет, <имя>!\``,
            initialCode: `name = input()\n# Выведите приветствие:\n`,
            solution: `name = input().strip()\nprint(f"Привет, {name}!")`,
            tests: [
              { input: 'Кирилл', expected: 'Привет, Кирилл!' },
              { input: 'Алексей', expected: 'Привет, Алексей!' }
            ]
          },
          {
            id: 'py-1-task-2',
            title: 'Задача: Квадрат числа',
            type: 'task',
            content: `# Задача: Квадрат числа

На вход подаётся одно целое число $N$. Выведите квадрат этого числа ($N^2$).`,
            initialCode: `n = int(input())\n# Выведите квадрат числа n:\n`,
            solution: `n = int(input())\nprint(n ** 2)`,
            tests: [
              { input: '5', expected: '25' },
              { input: '12', expected: '144' },
              { input: '-3', expected: '9' }
            ]
          }
        ]
      },
      {
        id: 'py-mod-2',
        title: 'Модуль 2. Циклы и списки',
        items: [
          {
            id: 'py-2-theory',
            title: 'Цикл for и функция range()',
            type: 'theory',
            content: `# Циклы и списки в Python

\`\`\`python
squares = [x ** 2 for x in range(10) if x % 2 == 0]
print(squares)
\`\`\``
          },
          {
            id: 'py-2-task-1',
            title: 'Задача: Сумма чётных чисел до N',
            type: 'task',
            content: `# Задача: Сумма чётных чисел до N

Вычислите и выведите сумму всех чётных чисел от $1$ до $N$ включительно.`,
            initialCode: `n = int(input())\ntotal = 0\n\nprint(total)`,
            solution: `n = int(input())\ntotal = sum(i for i in range(1, n + 1) if i % 2 == 0)\nprint(total)`,
            tests: [
              { input: '6', expected: '12' },
              { input: '10', expected: '30' },
              { input: '1', expected: '0' }
            ]
          }
        ]
      }
    ]
  }
];

// --- ДВИЖОК ВЫПОЛНЕНИЯ И ТЕСТИРОВАНИЯ КОДА ---

async function executeSingleRun(
  langKey: 'cpp' | 'python',
  code: string,
  stdinInput: string,
  taskId: string,
  expectedOutput: string,
  referenceSolution?: string
): Promise<ExecutionResult> {
  const cleanCode = code.trim();

  if (cleanCode.length > MAX_CODE_LENGTH) {
    return { stdout: '', stderr: `Код слишком длинный (максимум ${MAX_CODE_LENGTH} символов).`, engine: 'Validation' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    if (!RUN_URL) throw new Error('NEXT_PUBLIC_RUN_URL не задан');

    // Код выполняется на сервере проверки (свой Piston за прокси с лимитами)
    const response = await fetch(RUN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: langKey, code: cleanCode, stdin: stdinInput }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data: { stdout?: unknown; stderr?: unknown } = await response.json();
      return {
        stdout: String(data.stdout ?? '').trim(),
        stderr: String(data.stderr ?? '').trim(),
        engine: 'Sandbox Server'
      };
    }
    if (response.status === 429) {
      return { stdout: '', stderr: 'Слишком много запусков подряд. Подождите минуту и повторите.', engine: 'Rate Limit' };
    }
  } catch {
    // Сеть/таймаут — решаем ниже
  }

  // Упрощённый симулятор — только для разработки и демо. В продакшене он давал бы
  // «зачёт» по регулярным выражениям, а не по реальному выполнению кода.
  if (IS_DEMO_MODE) {
    return simulateLocalExecution(langKey, cleanCode, stdinInput, taskId, expectedOutput, referenceSolution);
  }
  return {
    stdout: '',
    stderr: 'Сервис проверки кода временно недоступен. Попробуйте позже — прогресс не потерян.',
    engine: 'Unavailable'
  };
}

function simulateLocalExecution(
  langKey: 'cpp' | 'python',
  code: string,
  stdinInput: string,
  taskId: string,
  expectedOutput: string,
  referenceSolution?: string
): ExecutionResult {
  const stripped =
    langKey === 'cpp'
      ? code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      : code.replace(/#.*$/gm, '');

  if (langKey === 'cpp') {
    if (!stripped.includes('main')) {
      return { stdout: '', stderr: 'error: undefined reference to `main`', engine: 'Local Sandbox' };
    }
    if (!stripped.includes('cout') && !stripped.includes('printf')) {
      return { stdout: '', stderr: 'Предупреждение: программа ничего не выводит в std::cout.', engine: 'Local Sandbox' };
    }
  } else {
    if (!stripped.includes('print')) {
      return { stdout: '', stderr: 'Программа не вызывает функцию print().', engine: 'Local Sandbox' };
    }
  }

  const tokens = stdinInput.trim().split(/\s+/);
  const lines = stdinInput.trim().split('\n');

  if (taskId === 'cpp-1-task-1') {
    const a = parseInt(tokens[0], 10);
    const b = parseInt(tokens[1], 10);
    const hasAddition = /\+\s*b|a\s*\+|sum\s*=|std::cout\s*<<\s*\(?\s*a\s*\+\s*b/.test(stripped);
    if (hasAddition) return { stdout: String(a + b), stderr: '', engine: 'Local Sandbox' };
    const hardcoded = stripped.match(/cout\s*<<\s*(\d+)/);
    return { stdout: hardcoded ? hardcoded[1] : '', stderr: '', engine: 'Local Sandbox' };
  }

  if (taskId === 'cpp-1-task-2') {
    const n = parseInt(tokens[0], 10);
    const hasModulo = /%\s*2/.test(stripped) || /&\s*1/.test(stripped);
    const hasEvenOdd = stripped.includes('EVEN') && stripped.includes('ODD');
    if (hasModulo && hasEvenOdd) {
      return { stdout: n % 2 === 0 ? 'EVEN' : 'ODD', stderr: '', engine: 'Local Sandbox' };
    }
    return { stdout: 'НЕВЕРНЫЙ_ВЫВОД', stderr: '', engine: 'Local Sandbox' };
  }

  if (taskId === 'cpp-2-task-1') {
    const n = parseInt(tokens[0], 10);
    const nums = tokens.slice(1, 1 + n).map(Number);
    const hasMaxLogic =
      stripped.includes('max_element') ||
      stripped.includes('std::max') ||
      />\s*max|max\s*</.test(stripped) ||
      /a\[i\]\s*>/.test(stripped);
    if (hasMaxLogic && nums.length > 0) {
      return { stdout: String(Math.max(...nums)), stderr: '', engine: 'Local Sandbox' };
    }
    return { stdout: '', stderr: 'Логика поиска максимума не обнаружена', engine: 'Local Sandbox' };
  }

  if (taskId === 'py-1-task-1') {
    const nameInput = lines[0] ? lines[0].trim() : '';
    const hasGreeting =
      stripped.includes('Привет,') &&
      (stripped.includes('f"') || stripped.includes("f'") || stripped.includes('+') || stripped.includes('format') || stripped.includes(','));
    if (hasGreeting && stripped.includes('input')) {
      return { stdout: `Привет, ${nameInput}!`, stderr: '', engine: 'Local Sandbox' };
    }
    return { stdout: '', stderr: '', engine: 'Local Sandbox' };
  }

  if (taskId === 'py-1-task-2') {
    const n = parseInt(tokens[0], 10);
    const hasSquare = /\*\*\s*2/.test(stripped) || /n\s*\*\s*n/.test(stripped) || /pow\s*\(/.test(stripped);
    if (hasSquare) return { stdout: String(n * n), stderr: '', engine: 'Local Sandbox' };
    return { stdout: '', stderr: '', engine: 'Local Sandbox' };
  }

  if (taskId === 'py-2-task-1') {
    const n = parseInt(tokens[0], 10);
    const hasLoopOrRange = stripped.includes('range') || stripped.includes('while');
    const hasEvenLogic = /%\s*2/.test(stripped) || /range\s*\(\s*2\s*,[^,]+,\s*2\s*\)/.test(stripped);
    if (hasLoopOrRange && hasEvenLogic) {
      let sum = 0;
      for (let i = 1; i <= n; i++) {
        if (i % 2 === 0) sum += i;
      }
      return { stdout: String(sum), stderr: '', engine: 'Local Sandbox' };
    }
    return { stdout: '0', stderr: '', engine: 'Local Sandbox' };
  }

  if (referenceSolution) {
    const normalize = (s: string) => s.replace(/\s+/g, '');
    if (normalize(stripped) === normalize(referenceSolution)) {
      return { stdout: expectedOutput, stderr: '', engine: 'Local Sandbox' };
    }
  }

  return { stdout: '', stderr: '', engine: 'Local Sandbox' };
}

function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

async function runTests(
  langKey: 'cpp' | 'python',
  code: string,
  tests: TestCase[],
  taskId: string,
  referenceSolution?: string
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const res = await executeSingleRun(langKey, code, test.input, taskId, test.expected, referenceSolution);
    const actual = normalizeOutput(res.stdout);
    const expected = normalizeOutput(test.expected);
    const passed = !res.stderr && actual === expected;

    results.push({
      index: i + 1,
      input: test.input,
      expected,
      actual: res.stderr ? `Ошибка: ${res.stderr}` : actual || '(пустой вывод)',
      passed,
      engine: res.engine
    });
  }
  return results;
}

// --- КОМПОНЕНТЫ ИНТЕРФЕЙСА ---

function MarkdownRenderer({ markdown }: { markdown: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = (codeText: string, idx: number) => {
    navigator.clipboard?.writeText(codeText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const blocks = useMemo(() => {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(markdown)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'text', content: match[2].trimEnd() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < markdown.length) {
      parts.push({ type: 'text', content: markdown.slice(lastIndex) });
    }
    return parts;
  }, [markdown]);

  const renderInlineFormatting = (text: string) => {
    const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return segments.map((seg: string, i: number) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 mx-0.5 text-xs font-mono rounded bg-slate-800 text-cyan-300 border border-slate-700">
            {seg.slice(1, -1)}
          </code>
        );
      }
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-white">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      return seg;
    });
  };

  return (
    <div className="space-y-4 leading-relaxed text-slate-300">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <div key={bIdx} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-lg my-4">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-mono uppercase tracking-wider text-blue-400 font-semibold">{block.lang}</span>
                <button
                  onClick={() => handleCopy(block.content, bIdx)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  {copiedIdx === bIdx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать код</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-100 leading-relaxed">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        const lines = block.content.split('\n');
        return (
          <div key={bIdx} className="space-y-2.5">
            {lines.map((line: string, lIdx: number) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={lIdx} className="text-2xl sm:text-3xl font-bold text-white tracking-tight pt-1 pb-2 border-b border-slate-800/80">
                    {trimmed.slice(2)}
                  </h1>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={lIdx} className="text-lg font-semibold text-blue-400 pt-3">
                    {trimmed.slice(4)}
                  </h3>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={lIdx} className="text-xl font-bold text-white pt-3">
                    {trimmed.slice(3)}
                  </h2>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <div key={lIdx} className="p-3.5 rounded-xl bg-blue-950/30 border-l-4 border-blue-500 text-slate-200 text-sm">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </div>
                );
              }
              if (trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
                const contentText = trimmed.replace(/^(-|\d+\.)\s+/, '');
                const numMatch = trimmed.match(/^(\d+)\.\s/);
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 pl-2">
                    {numMatch ? (
                      <span className="text-blue-400 font-semibold text-sm mt-0.5 min-w-[1.25rem] flex-shrink-0">
                        {numMatch[1]}.
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 flex-shrink-0" />
                    )}
                    <span>{renderInlineFormatting(contentText)}</span>
                  </div>
                );
              }
              return (
                <p key={lIdx} className="text-slate-300 leading-7">
                  {renderInlineFormatting(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  language: string;
  onReset: () => void;
  onFillSolution: () => void;
  onRun?: () => void;
}

function CodeEditor({ code, onChange, language, onReset, onFillSolution, onRun }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max((code || '').split('\n').length, 12);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      onChange(newCode);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <FileCode className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-mono text-slate-300 font-medium">
            {language === 'C++' ? 'main.cpp (C++17)' : 'solution.py (Python 3)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRun && <span className="hidden md:inline text-[11px] text-slate-500">Ctrl+Enter — запуск тестов</span>}
          <button
            type="button"
            onClick={onFillSolution}
            className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Подставить решение</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 min-h-[240px] font-mono text-sm overflow-hidden">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="select-none py-4 px-3 text-right bg-slate-950/60 text-slate-600 border-r border-slate-800/80 font-mono text-xs leading-6 overflow-hidden"
        >
          {Array.from({ length: lineCount }).map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          aria-label="Редактор кода"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="flex-1 w-full p-4 bg-transparent text-emerald-100 caret-blue-400 focus:outline-none resize-none font-mono text-sm leading-6 overflow-auto"
          placeholder="// Напишите ваш код здесь..."
        />
      </div>
    </div>
  );
}

interface CertificateViewProps {
  course: Course;
  studentName: string;
  setStudentName: React.Dispatch<React.SetStateAction<string>>;
  isCompleted: boolean;
  onBackToLearn: () => void;
}

function CertificateView({ course, studentName, setStudentName, isCompleted, onBackToLearn }: CertificateViewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const issueDate = useMemo(() => {
    return new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }, []);

  const certId = useMemo(() => {
    const prefix = course.langKey.toUpperCase();
    const hash = Math.abs(course.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) * 7919)
      .toString()
      .slice(0, 6);
    return `DC-${prefix}-2026-${hash}`;
  }, [course]);

  const handleDownloadCertificate = () => {
    setIsDownloading(true);
    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1414;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bgGrad = ctx.createLinearGradient(0, 0, 2000, 1414);
        bgGrad.addColorStop(0, '#020617');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 2000, 1414);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 6;
        ctx.strokeRect(70, 70, 1860, 1274);

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.strokeRect(92, 92, 1816, 1230);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('DEVCOURSES • ОБРАЗОВАТЕЛЬНАЯ ПЛАТФОРМА', 1000, 220);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 76px serif';
        ctx.fillText('СЕРТИФИКАТ ОБ ОКОНЧАНИИ', 1000, 340);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '32px sans-serif';
        ctx.fillText('Настоящим подтверждается, что', 1000, 440);

        const fitFont = (text: string, template: (size: number) => string, maxWidth: number, start: number, min: number) => {
          let size = start;
          ctx.font = template(size);
          while (ctx.measureText(text).width > maxWidth && size > min) {
            size -= 2;
            ctx.font = template(size);
          }
        };

        const displayName = (studentName || 'Иван Иванов').trim();
        ctx.fillStyle = '#fbbf24';
        fitFont(displayName, (sz) => `italic bold ${sz}px serif`, 1500, 86, 36);
        ctx.fillText(displayName, 1000, 580);

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(500, 620);
        ctx.lineTo(1500, 620);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '32px sans-serif';
        ctx.fillText('успешно завершил(а) теоретическую и практическую программу курса', 1000, 710);

        ctx.fillStyle = '#38bdf8';
        const courseLabel = `«${course.title}»`;
        fitFont(courseLabel, (sz) => `bold ${sz}px sans-serif`, 1700, 58, 28);
        ctx.fillText(courseLabel, 1000, 815);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px sans-serif';
        ctx.fillText(`Язык программирования: ${course.language} • Уровень: ${course.level} • Выполнено 100% задач`, 1000, 890);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '26px sans-serif';
        ctx.fillText('Дата выдачи:', 180, 1140);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText(issueDate, 180, 1185);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '26px sans-serif';
        ctx.fillText('ID документа:', 1820, 1140);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 30px monospace';
        ctx.fillText(certId, 1820, 1185);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `certificate-${course.id}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 4000);
      } finally {
        setIsDownloading(false);
      }
    }, 200);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToLearn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors text-sm"
        >
          ← Вернуться к урокам курса
        </button>

        {!isCompleted && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Предпросмотр сертификата (завершите все уроки или нажмите «Демо: Открыть всё» в шапке)</span>
          </div>
        )}
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Имя и Фамилия выпускника (отображается на бланке)
          </label>
          <input
            type="text"
            value={studentName}
            maxLength={80}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Например: Кирилл Горгос"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white font-medium"
          />
        </div>

        <button
          onClick={handleDownloadCertificate}
          disabled={isDownloading || !isCompleted}
          title={isCompleted ? undefined : 'Завершите все уроки курса, чтобы скачать сертификат'}
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Download className="w-5 h-5" />
          <span>{isDownloading ? 'Генерация PNG...' : downloadSuccess ? 'Сертификат скачан! ✅' : 'Скачать сертификат (PNG)'}</span>
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl p-1 bg-gradient-to-br from-blue-500 via-amber-400 to-emerald-500 shadow-2xl">
        <div className="relative rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-12 md:p-16 border-4 border-double border-amber-400/40 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs uppercase tracking-widest font-semibold">
            <Award className="w-4 h-4 text-amber-400" />
            DevCourses • Official Certificate
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-wide">
            СЕРТИФИКАТ ОБ ОКОНЧАНИИ
          </h1>

          <p className="text-slate-400 text-sm sm:text-base">Настоящим подтверждается, что</p>

          <div className="py-2">
            <div className="inline-block px-8 pb-3 border-b-2 border-amber-400/50 text-2xl sm:text-4xl md:text-5xl font-serif italic font-bold text-amber-300">
              {studentName.trim() || 'Иван Иванов'}
            </div>
          </div>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            успешно освоил(а) теоретический материал и решил(а) все практические алгоритмические задачи курса
          </p>

          <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            «{course.title}»
          </h2>

          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-t border-slate-800/80 text-xs sm:text-sm">
            <div className="text-center sm:text-left">
              <div className="text-slate-500">Дата выдачи</div>
              <div className="font-semibold text-slate-200 mt-0.5">{issueDate}</div>
            </div>

            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full border-2 border-amber-400/70 bg-amber-400/10 flex flex-col items-center justify-center text-amber-300">
                <Trophy className="w-6 h-6 mb-0.5" />
                <span className="text-[10px] font-bold tracking-wider uppercase">100% PASS</span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="text-slate-500">ID верификации</div>
              <div className="font-mono font-semibold text-slate-200 mt-0.5">{certId}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- ДЕКОРАТИВНОЕ ОКНО КОДА ДЛЯ HERO-БЛОКА ---

const HERO_CODE: Array<Array<[string, string]>> = [
  [['// Сумма двух чисел', 'text-slate-500']],
  [['#include ', 'text-blue-400'], ['<iostream>', 'text-amber-300']],
  [['', '']],
  [['int ', 'text-blue-400'], ['main', 'text-emerald-300'], ['() {', 'text-slate-300']],
  [['    int ', 'text-blue-400'], ['a, b;', 'text-slate-200']],
  [['    std::cin >> a >> b;', 'text-slate-200']],
  [['    std::cout << ', 'text-slate-200'], ['(a + b)', 'text-amber-300'], [' << "\\n";', 'text-slate-200']],
  [['    return ', 'text-blue-400'], ['0', 'text-amber-300'], [';', 'text-slate-200']],
  [['}', 'text-slate-300']]
];

function HeroCodeWindow() {
  return (
    <div aria-hidden="true" className="relative hidden lg:block">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-blue-600/25 via-transparent to-amber-400/10 blur-2xl" />
      <div className="relative rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-black/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] bg-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <span className="font-mono text-[11px] text-slate-500">main.cpp</span>
          <span className="w-10" />
        </div>
        <div className="flex font-mono text-[13px] leading-7">
          <div className="select-none py-4 pl-4 pr-3 text-right text-slate-600">
            {HERO_CODE.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="py-4 pr-5 overflow-hidden">
            {HERO_CODE.map((line, i) => (
              <div key={i} className="whitespace-pre min-h-7">
                {line.map(([text, color], j) => (
                  <span key={j} className={color}>
                    {text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.07] bg-emerald-500/[0.06]">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> 3 из 3 тестов пройдено
          </span>
          <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">+50 XP</span>
        </div>
      </div>
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ ---

export default function App() {
  const [coursesList, setCoursesList] = useState<Course[]>(COURSES_DATA);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('cpp-basics');
  const [selectedItemId, setSelectedItemId] = useState<string>('cpp-1-theory');

  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>(['cpp-basics']);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [userCodeMap, setUserCodeMap] = useState<Record<string, string>>({});
  const [studentName, setStudentName] = useState<string>('Кирилл Разработчик');

  // --- СОСТОЯНИЕ АККАУНТА И ЛИЧНОГО КАБИНЕТА ---
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('👨‍💻');
  const [userBio, setUserBio] = useState<string>('Изучаю C++ и Python на платформе DevCourses');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);

  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    'cpp-mod-1': true,
    'cpp-mod-2': true,
    'py-mod-1': true,
    'py-mod-2': true
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const activeItemRef = useRef<string>('cpp-1-theory');

  // Роль администратора (только для показа ссылки; реальная защита — RLS в Supabase)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminUser(session?.user?.app_metadata?.role === 'admin');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Загрузка курсов и сессии пользователя при старте
  useEffect(() => {
    let isMounted = true;

    async function initPlatform() {
      try {
        safeRemove('dc_session_email'); // устаревший ключ

        // Каждый ключ читается отдельно и проверяется: битые данные не ломают остальные
        const savedCustomCourses = readJSON('dc_custom_courses', isCourseList);
        const savedEnrolled = readJSON('dc_enrolled', isStringArray);
        const savedCompleted = readJSON('dc_completed', isStringArray);
        const savedCode = readJSON('dc_code_map', isStringRecord);
        const savedName = safeGet('dc_student_name');
        const savedAvatar = safeGet('dc_user_avatar');
        const savedBio = safeGet('dc_user_bio');

        if (savedCustomCourses && isMounted) setCoursesList(savedCustomCourses as Course[]);
        if (savedEnrolled && isMounted) setEnrolledCourses(savedEnrolled);
        if (savedCompleted && isMounted) setCompletedItems(savedCompleted);
        if (savedCode && isMounted) setUserCodeMap(savedCode);
        if (savedName && isMounted) setStudentName(savedName.slice(0, 80));
        if (savedAvatar && isMounted && AVATAR_OPTIONS.includes(savedAvatar)) setUserAvatar(savedAvatar);
        if (savedBio && isMounted) setUserBio(savedBio.slice(0, 300));

        // Подгрузка курсов из облака Supabase
        const { data: coursesData } = await supabase
          .from('courses')
          .select('data')
          .order('created_at', { ascending: true });

        if (coursesData && coursesData.length > 0 && isMounted) {
          const cloudCourses = coursesData
            .map((row: { data: unknown }) => row.data)
            .filter((c: unknown) => isCourseList([c])) as Course[];
          if (cloudCourses.length > 0) {
            setCoursesList(cloudCourses);
            safeSet('dc_custom_courses', JSON.stringify(cloudCourses));
          }
        }

        // Если пользователь уже входил в аккаунт — подгружаем его профиль из Supabase
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData.session?.user?.email?.toLowerCase();

        if (sessionEmail && isMounted) {
          const { data: accData } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('email', sessionEmail)
            .maybeSingle();

          if (accData && isMounted) {
            const account: UserAccount = {
              email: accData.email,
              display_name: accData.display_name,
              avatar: accData.avatar || '👨‍💻',
              bio: accData.bio || '',
              enrolled_courses: Array.isArray(accData.enrolled_courses) ? accData.enrolled_courses : ['cpp-basics'],
              completed_items: Array.isArray(accData.completed_items) ? accData.completed_items : [],
              user_code_map: accData.user_code_map || {}
            };
            setCurrentUser(account);
            setStudentName(account.display_name);
            setUserAvatar(account.avatar);
            setUserBio(account.bio);
            setEnrolledCourses(account.enrolled_courses);
            setCompletedItems(account.completed_items);
            setUserCodeMap(account.user_code_map);
          }
        }
      } catch {
        // Работаем на локальном кэше
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    }

    initPlatform();
    return () => {
      isMounted = false;
    };
  }, []);

  // Локальное сохранение (с задержкой, чтобы не писать весь код в localStorage на каждый символ)
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('dc_enrolled', JSON.stringify(enrolledCourses));
        localStorage.setItem('dc_completed', JSON.stringify(completedItems));
        localStorage.setItem('dc_code_map', JSON.stringify(userCodeMap));
        localStorage.setItem('dc_student_name', studentName);
        localStorage.setItem('dc_user_avatar', userAvatar);
        localStorage.setItem('dc_user_bio', userBio);
      } catch {
        // Игнорируем переполнение
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [enrolledCourses, completedItems, userCodeMap, studentName, userAvatar, userBio, isHydrated]);

  // Фоновая синхронизация с облачным аккаунтом Supabase
  useEffect(() => {
    if (!isHydrated || !currentUser) return;
    const timer = setTimeout(async () => {
      try {
        await supabase
          .from('user_accounts')
          .update({
            display_name: studentName,
            avatar: userAvatar,
            bio: userBio,
            enrolled_courses: enrolledCourses,
            completed_items: completedItems,
            user_code_map: userCodeMap,
            updated_at: new Date().toISOString()
          })
          .eq('email', currentUser.email);
      } catch {
        // Игнорируем ошибку фоновой синхронизации
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [enrolledCourses, completedItems, userCodeMap, studentName, userAvatar, userBio, currentUser, isHydrated]);

  // --- ФУНКЦИИ РЕГИСТРАЦИИ И ВХОДА В АККАУНТ ---

  const showSync = (message: string, ms = 4000) => {
    setSyncMessage(message);
    setTimeout(() => setSyncMessage(null), ms);
  };

  const rowToAccount = (row: Partial<UserAccount> & { email: string }): UserAccount => ({
    email: row.email,
    display_name: row.display_name || 'Студент DevCourses',
    avatar: row.avatar || '👨‍💻',
    bio: row.bio || '',
    enrolled_courses: Array.isArray(row.enrolled_courses) ? row.enrolled_courses : ['cpp-basics'],
    completed_items: Array.isArray(row.completed_items) ? row.completed_items : [],
    user_code_map: row.user_code_map || {}
  });

  const applyAccount = (acc: UserAccount) => {
    setCurrentUser(acc);
    setStudentName(acc.display_name);
    setUserAvatar(acc.avatar);
    setUserBio(acc.bio);
    setEnrolledCourses(acc.enrolled_courses);
    setCompletedItems(acc.completed_items);
    setUserCodeMap(acc.user_code_map);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanName = authName.trim() || 'Студент DevCourses';

    if (!cleanEmail || !authPassword) {
      setAuthError('Пожалуйста, введите Email и пароль.');
      return;
    }
    if (authMode === 'register' && authPassword.length < 8) {
      setAuthError('Пароль должен содержать не менее 8 символов.');
      return;
    }

    setAuthLoading(true);
    try {
      const localProfile: UserAccount = {
        email: cleanEmail,
        display_name: cleanName,
        avatar: userAvatar,
        bio: userBio,
        enrolled_courses: enrolledCourses,
        completed_items: completedItems,
        user_code_map: userCodeMap
      };

      if (authMode === 'register') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: authPassword,
          options: { data: { display_name: cleanName } }
        });

        if (signUpError) {
          setAuthError(signUpError.message);
          return;
        }

        if (!signUpData.session) {
          // В проекте включено подтверждение почты — профиль создастся при первом входе
          setAuthMode('login');
          setAuthPassword('');
          showSync('Мы отправили письмо для подтверждения Email. Подтвердите адрес и войдите в аккаунт 📬', 8000);
          return;
        }

        const { error: insertError } = await supabase.from('user_accounts').insert([localProfile]);
        if (insertError) {
          setAuthError(`Ошибка создания профиля: ${insertError.message}`);
          return;
        }

        setCurrentUser(localProfile);
        setStudentName(cleanName);
        showSync('Аккаунт создан и синхронизирован с облаком! 🎉');
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authPassword
        });

        if (signInError || !signInData.session) {
          setAuthError('Неверный Email или пароль.');
          return;
        }

        const { data: row } = await supabase
          .from('user_accounts')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (row) {
          applyAccount(rowToAccount(row));
        } else {
          // Первый вход после подтверждения почты — создаём профиль из локального прогресса
          await supabase.from('user_accounts').insert([localProfile]);
          setCurrentUser(localProfile);
          setStudentName(cleanName);
        }
        showSync('Вы успешно вошли! Весь ваш прогресс загружен из облака ☁️');
      }
      setAuthPassword('');
    } catch {
      setAuthError('Не удалось подключиться к Supabase.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Выходим локально в любом случае
    }
    // Сбрасываем прогресс, чтобы он не «утёк» следующему пользователю этого браузера
    setCurrentUser(null);
    setEnrolledCourses(['cpp-basics']);
    setCompletedItems([]);
    setUserCodeMap({});
    setStudentName('Кирилл Разработчик');
    setUserAvatar('👨‍💻');
    setUserBio('Изучаю C++ и Python на платформе DevCourses');
    showSync('Вы вышли из аккаунта.', 3000);
  };

  const handleManualProfileSave = async () => {
    if (!currentUser) {
      setSyncMessage('Профиль сохранён локально в браузере ✅');
      setTimeout(() => setSyncMessage(null), 3000);
      return;
    }

    setAuthLoading(true);
    try {
      await supabase
        .from('user_accounts')
        .update({
          display_name: studentName,
          avatar: userAvatar,
          bio: userBio,
          enrolled_courses: enrolledCourses,
          completed_items: completedItems,
          user_code_map: userCodeMap,
          updated_at: new Date().toISOString()
        })
        .eq('email', currentUser.email);

      setSyncMessage('Профиль и прогресс сохранены в облаке ☁️✅');
      setTimeout(() => setSyncMessage(null), 3500);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- РАСЧЁТ РАНГА И XP ---

  const totalXp = completedItems.length * 50;
  const userRank = useMemo(() => {
    if (totalXp >= 400) return { title: 'Senior Архитектор', nextXp: 600, color: 'text-amber-400 border-amber-500/40 bg-amber-500/15' };
    if (totalXp >= 250) return { title: 'Middle Разработчик', nextXp: 400, color: 'text-purple-400 border-purple-500/40 bg-purple-500/15' };
    if (totalXp >= 100) return { title: 'Junior Разработчик', nextXp: 250, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15' };
    if (totalXp >= 50) return { title: 'Стажёр (Intern)', nextXp: 100, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/15' };
    return { title: 'Новичок', nextXp: 50, color: 'text-slate-300 border-slate-700 bg-slate-800' };
  }, [totalXp]);

  const currentCourse = useMemo<Course>(
    () => coursesList.find((c) => c.id === selectedCourseId) || coursesList[0] || COURSES_DATA[0],
    [coursesList, selectedCourseId]
  );

  const flatCourseItems = useMemo<FlatCourseItem[]>(() => {
    const list: FlatCourseItem[] = [];
    currentCourse.modules.forEach((mod) => {
      mod.items.forEach((item) => {
        list.push({ ...item, moduleId: mod.id, moduleTitle: mod.title });
      });
    });
    return list;
  }, [currentCourse]);

  const currentItem = useMemo<FlatCourseItem>(
    () => flatCourseItems.find((item) => item.id === selectedItemId) || flatCourseItems[0],
    [flatCourseItems, selectedItemId]
  );

  const selectLessonItem = (itemId: string) => {
    activeItemRef.current = itemId;
    setSelectedItemId(itemId);
    setTestResults(null);
    setShowSolution(false);
  };

  const getCourseProgress = (course: Course) => {
    const allIds = course.modules.flatMap((m: CourseModule) => m.items.map((i: CourseItem) => i.id));
    if (allIds.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completedCount = allIds.filter((id: string) => completedItems.includes(id)).length;
    return {
      completed: completedCount,
      total: allIds.length,
      percent: Math.round((completedCount / allIds.length) * 100)
    };
  };

  const handleEnrollAndOpen = (courseId: string) => {
    if (!enrolledCourses.includes(courseId)) {
      setEnrolledCourses((prev) => [...prev, courseId]);
    }
    const targetCourse = coursesList.find((c) => c.id === courseId) || coursesList[0];
    const firstMod = targetCourse?.modules[0];
    const firstItem = firstMod?.items[0]?.id;
    setSelectedCourseId(courseId);
    if (firstMod) {
      setOpenModules((prev) => ({ ...prev, [firstMod.id]: true }));
    }
    if (firstItem) selectLessonItem(firstItem);
    setActiveTab('learn');
  };

  const markItemCompleted = (itemId: string) => {
    setCompletedItems((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  };

  const goToNextItem = () => {
    markItemCompleted(currentItem.id);
    const idx = flatCourseItems.findIndex((i) => i.id === currentItem.id);
    if (idx >= 0 && idx < flatCourseItems.length - 1) {
      const next = flatCourseItems[idx + 1];
      selectLessonItem(next.id);
      setOpenModules((prev) => ({ ...prev, [next.moduleId]: true }));
    } else {
      setActiveTab('certificate');
    }
  };

  const handleDemoUnlockAll = () => {
    const allCourseIds = coursesList.map((c) => c.id);
    const allItemIds = coursesList.flatMap((c) => c.modules.flatMap((m) => m.items.map((i) => i.id)));
    setEnrolledCourses(allCourseIds);
    setCompletedItems(allItemIds);
  };

  const currentCode =
    userCodeMap[currentItem?.id] !== undefined ? userCodeMap[currentItem.id] : currentItem?.initialCode || '';

  const handleCodeChange = (newCode: string) => {
    setUserCodeMap((prev) => ({
      ...prev,
      [currentItem.id]: newCode
    }));
  };

  const handleRunTaskTests = async () => {
    if (!currentItem || currentItem.type !== 'task' || isRunningTests) return;
    const runItemId = currentItem.id;
    setIsRunningTests(true);
    setTestResults(null);

    try {
      const results = await runTests(
        currentCourse.langKey,
        currentCode,
        currentItem.tests || [],
        runItemId,
        currentItem.solution
      );

      if (results.length > 0 && results.every((r: TestResult) => r.passed)) {
        markItemCompleted(runItemId);
      }
      // Не показываем результаты, если пользователь уже перешёл на другой урок
      if (activeItemRef.current === runItemId) setTestResults(results);
    } finally {
      setIsRunningTests(false);
    }
  };

  const allTestsPassed =
    testResults !== null && testResults.length > 0 && testResults.every((r: TestResult) => r.passed);

  const filteredCourses = useMemo(() => {
    return coursesList.filter((course) => {
      const matchesLang = langFilter === 'ALL' || course.language === langFilter;
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLang && matchesSearch;
    });
  }, [coursesList, langFilter, searchQuery]);

  const catalogStats = useMemo(() => {
    let lessons = 0;
    let tasks = 0;
    coursesList.forEach((c) =>
      c.modules.forEach((m) =>
        m.items.forEach((i) => {
          lessons += 1;
          if (i.type === 'task') tasks += 1;
        })
      )
    );
    return { courses: coursesList.length, lessons, tasks };
  }, [coursesList]);

  const navItems: Array<{
    id: TabType;
    label: string;
    short: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: 'Дашборд', short: 'Главная', icon: LayoutDashboard },
    { id: 'catalog', label: 'Каталог', short: 'Каталог', icon: Compass },
    { id: 'my-learning', label: 'Моё обучение', short: 'Учёба', icon: GraduationCap },
    { id: 'certificates', label: 'Сертификаты', short: 'Дипломы', icon: Award },
    { id: 'profile', label: 'Личный кабинет', short: 'Профиль', icon: User }
  ];

  const xpPercent = Math.min(100, Math.round((totalXp / userRank.nextXp) * 100));

  return (
    <div className="min-h-screen text-slate-200 flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-blue-600 focus:text-white"
      >
        Перейти к содержимому
      </a>

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 min-w-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              aria-label="DevCourses — на главную"
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <span className="relative grid place-items-center w-9 h-9 rounded-[11px] bg-gradient-to-br from-blue-500 to-blue-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_8px_24px_-8px_var(--color-blue-500)] transition-transform group-hover:-rotate-6">
                <Code2 className="w-5 h-5 text-white" />
                <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950" />
              </span>
              <span className="leading-none">
                <span className="block font-bold text-[17px] tracking-tight text-white">DevCourses</span>
                <span className="block mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">учись кодом</span>
              </span>
            </button>

            <nav
              aria-label="Основная навигация"
              className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]"
            >
              {navItems
                .filter((nav) => nav.id !== 'profile')
                .map((nav) => (
                  <button
                    key={nav.id}
                    onClick={() => setActiveTab(nav.id)}
                    aria-current={activeTab === nav.id ? 'page' : undefined}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                      activeTab === nav.id
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {nav.label}
                  </button>
                ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex flex-col gap-1 min-w-[92px] px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]"
              title={`До следующего ранга: ${Math.max(0, userRank.nextXp - totalXp)} XP`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-bold text-amber-300 tabular-nums">
                  <Flame className="w-3.5 h-3.5" />
                  {totalXp}
                </span>
                <span className="text-slate-500">XP</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            {IS_DEMO_MODE && (
              <button
                onClick={handleDemoUnlockAll}
                className="hidden md:flex px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Демо</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('profile')}
              className={`pl-1.5 pr-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${
                currentUser
                  ? 'bg-blue-600/15 border-blue-500/40 text-blue-100 hover:bg-blue-600/25'
                  : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/[0.08]'
              }`}
            >
              <span className="grid place-items-center w-7 h-7 rounded-full bg-slate-950/70 text-base leading-none">
                {userAvatar}
              </span>
              <span className="max-w-[110px] truncate">{currentUser ? studentName : 'Войти'}</span>
            </button>

            {isAdminUser && (
              <Link
                href="/admin"
                className="px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Админка</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className={`flex-1 flex flex-col ${activeTab !== 'learn' ? 'pb-24 lg:pb-0' : ''}`}>
        {/* РАЗДЕЛ: ЛИЧНЫЙ КАБИНЕТ И АВТОРИЗАЦИЯ */}
        {activeTab === 'profile' && (
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
            {syncMessage && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Левая колонка: Вход / Регистрация или Карточка Аккаунта */}
              <div className="lg:col-span-5 space-y-6">
                {!currentUser ? (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          Облачный аккаунт
                        </span>
                        <h2 className="text-2xl font-bold text-white mt-1">
                          {authMode === 'login' ? 'Вход в личный кабинет' : 'Регистрация ученика'}
                        </h2>
                      </div>
                      <User className="w-8 h-8 text-blue-400" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthError(null);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          authMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <LogIn className="w-3.5 h-3.5" /> Вход
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setAuthError(null);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          authMode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Регистрация
                      </button>
                    </div>

                    {authError && (
                      <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                      {authMode === 'register' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-400">
                            Ваше Имя и Фамилия (для сертификатов)
                          </label>
                          <input
                            type="text"
                            required
                            value={authName}
                            maxLength={80}
                            autoComplete="name"
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="Кирилл Горгос"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Email адрес</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          maxLength={254}
                          autoComplete="email"
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="student@example.com"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Пароль</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/25 cursor-pointer transition-all"
                      >
                        {authLoading
                          ? 'Синхронизация...'
                          : authMode === 'login'
                          ? 'Войти и загрузить прогресс'
                          : 'Создать аккаунт и сохранить прогресс'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                        <Cloud className="w-4 h-4" /> Облако подключено
                      </span>
                      <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Выйти
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-blue-500/40 flex items-center justify-center text-4xl shadow-inner">
                        {userAvatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold text-white truncate">{studentName}</h2>
                        <p className="text-xs text-slate-400 font-mono truncate">{currentUser.email}</p>
                        <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold border ${userRank.color}`}>
                          {userRank.title}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <label className="block text-xs font-semibold text-slate-400">Выберите аватар профиля</label>
                      <div className="flex flex-wrap gap-2">
                        {AVATAR_OPTIONS.map((emo) => (
                          <button
                            key={emo}
                            type="button"
                            onClick={() => setUserAvatar(emo)}
                            className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer ${
                              userAvatar === emo
                                ? 'bg-blue-600/25 border-blue-500 scale-110'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400">Имя и Фамилия (для сертификатов)</label>
                        <input
                          type="text"
                          value={studentName}
                          maxLength={80}
            onChange={(e) => setStudentName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-400">О себе / Цель обучения</label>
                        <textarea
                          rows={2}
                          value={userBio}
                          maxLength={300}
                          onChange={(e) => setUserBio(e.target.value)}
                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleManualProfileSave}
                        disabled={authLoading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        <span>{authLoading ? 'Сохранение...' : 'Сохранить профиль в облако'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Правая колонка: Статистика, Ранг, Курсы и Сертификаты ученика */}
              <div className="lg:col-span-7 space-y-6">
                {/* Карточка ранга и опыта */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                        Ранг разработчика
                      </span>
                      <h3 className="text-2xl font-extrabold text-white mt-0.5">{userRank.title}</h3>
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-amber-400" />
                      <span className="text-lg font-extrabold text-white">{totalXp} XP</span>
                      <span className="text-xs text-slate-400">/ {userRank.nextXp} XP</span>
                    </div>
                  </div>

                  <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.round((totalXp / userRank.nextXp) * 100))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center">
                      <div className="text-2xl font-extrabold text-white">{enrolledCourses.length}</div>
                      <div className="text-[11px] text-slate-400">Активных курсов</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center">
                      <div className="text-2xl font-extrabold text-emerald-400">{completedItems.length}</div>
                      <div className="text-[11px] text-slate-400">Пройдено шагов</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center">
                      <div className="text-2xl font-extrabold text-amber-400">
                        {coursesList.filter((c) => getCourseProgress(c).percent === 100).length}
                      </div>
                      <div className="text-[11px] text-slate-400">Сертификатов</div>
                    </div>
                  </div>
                </div>

                {/* Прогресс по курсам в Личном кабинете */}
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-400" />
                    <span>Мои курсы и сертификаты</span>
                  </h3>

                  <div className="space-y-3">
                    {coursesList.map((course) => {
                      const prog = getCourseProgress(course);
                      return (
                        <div
                          key={course.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${course.badgeBg}`}>
                                {course.language}
                              </span>
                              <span className="text-sm font-bold text-white">{course.title}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${course.accent}`}
                                style={{ width: `${prog.percent}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Прогресс: {prog.completed} из {prog.total} ({prog.percent}%)
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEnrollAndOpen(course.id)}
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                            >
                              Учиться
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCourseId(course.id);
                                setActiveTab('certificate');
                              }}
                              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Award className="w-3.5 h-3.5" /> Сертификат
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ДАШБОРД / КАТАЛОГ / МОЁ ОБУЧЕНИЕ / СЕРТИФИКАТЫ */}
        {(activeTab === 'dashboard' ||
          activeTab === 'catalog' ||
          activeTab === 'my-learning' ||
          activeTab === 'certificates') && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
            {activeTab === 'dashboard' && (
              <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-slate-900/60 px-6 py-10 sm:px-12 sm:py-14 lg:py-16">
                <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-600/25 blur-3xl" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />

                <div className="relative grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
                  <div className="space-y-6">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      Автопроверка кода прямо в браузере
                    </span>

                    <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05] text-white text-balance">
                      Учись программировать,{' '}
                      <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-amber-300 bg-clip-text text-transparent">
                        решая задачи
                      </span>
                      , а не читая лекции
                    </h1>

                    <p className="max-w-xl text-base sm:text-lg text-slate-400 leading-relaxed">
                      Теория по C++ и Python, редактор кода с тестами, личный кабинет с прогрессом и именные
                      сертификаты — всё бесплатно.
                    </p>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={() => handleEnrollAndOpen(coursesList[0]?.id || 'cpp-basics')}
                        className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-[0_12px_32px_-12px_var(--color-blue-500)] flex items-center gap-2 transition-all hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Начать обучение</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('profile')}
                        className="px-6 py-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-100 font-semibold text-sm border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <User className="w-4 h-4 text-blue-300" />
                        <span>{currentUser ? 'Личный кабинет' : 'Войти / Создать аккаунт'}</span>
                      </button>
                    </div>

                    <dl className="flex flex-wrap gap-x-10 gap-y-3 pt-6 border-t border-white/[0.06]">
                      {[
                        ['Курсов', catalogStats.courses],
                        ['Уроков', catalogStats.lessons],
                        ['Практических задач', catalogStats.tasks]
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="text-2xl font-bold text-white tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <HeroCodeWindow />
                </div>
              </section>
            )}

            {(activeTab === 'dashboard' || activeTab === 'my-learning') && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                    <GraduationCap className="w-6 h-6 text-blue-400" />
                    <span>Моё обучение</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {coursesList
                    .filter((c) => enrolledCourses.includes(c.id))
                    .map((course) => {
                      const prog = getCourseProgress(course);
                      return (
                        <div
                          key={course.id}
                          className="relative overflow-hidden p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-5 shadow-lg"
                        >
                          <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${course.accent}`} />
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${course.badgeBg}`}>
                                {course.language}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                Завершено: {prog.completed} из {prog.total} ({prog.percent}%)
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-white">{course.title}</h3>
                            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${course.accent} transition-all duration-500`}
                                style={{ width: `${prog.percent}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                              onClick={() => handleEnrollAndOpen(course.id)}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                              <span>Продолжить обучение</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedCourseId(course.id);
                                setActiveTab('certificate');
                              }}
                              className="py-2.5 px-4 rounded-xl text-sm font-semibold border bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Award className="w-4 h-4 text-amber-400" />
                              <span>Сертификат</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {activeTab === 'certificates' && (
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                  <Award className="w-6 h-6 text-amber-400" />
                  <span>Ваши сертификаты</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {coursesList.map((course) => {
                    const prog = getCourseProgress(course);
                    return (
                      <div key={course.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${course.badgeBg}`}>
                              {course.language}
                            </span>
                            <span className="text-xs text-slate-400">Прогресс: {prog.percent}%</span>
                          </div>
                          <h3 className="text-lg font-bold text-white">{course.title}</h3>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setActiveTab('certificate');
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                          <span>Открыть и скачать сертификат</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(activeTab === 'dashboard' || activeTab === 'catalog') && (
              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                    <Layers className="w-6 h-6 text-cyan-400" />
                    <span>Каталог курсов</span>
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск курса..."
                        className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {['ALL', 'C++', 'Python'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLangFilter(lang)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          langFilter === lang
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {lang === 'ALL' ? 'Все языки' : lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredCourses.map((course) => {
                    const isEnrolled = enrolledCourses.includes(course.id);
                    return (
                      <div
                        key={course.id}
                        className="group relative overflow-hidden rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-blue-500/60 hover:-translate-y-0.5 transition-all p-6 flex flex-col justify-between gap-6 shadow-xl"
                      >
                        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${course.accent}`} />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${course.badgeBg}`}>
                              {course.language}
                            </span>
                            <span className="text-xs text-slate-400">
                              {course.level} • {course.duration}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-white">{course.title}</h3>
                          <p className="text-sm text-slate-400 leading-relaxed">{course.description}</p>

                          <p className="text-xs text-slate-500 font-mono">
                            {courseStats(course).modules} модулей · {courseStats(course).lessons} уроков ·{' '}
                            {courseStats(course).tasks} задач
                          </p>

                          {course.skills && course.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {course.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleEnrollAndOpen(course.id)}
                          className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <span>{isEnrolled ? 'Открыть курс (Вы зачислены)' : 'Поступить на курс (Бесплатно)'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ИНТЕРФЕЙС ПРОХОЖДЕНИЯ УРОКОВ И ЗАДАЧ */}
        {activeTab === 'learn' && currentItem && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="truncate pr-2">
                <div className="text-xs text-blue-400 font-semibold">{currentCourse.title}</div>
                <div className="text-sm font-bold text-white truncate">{currentItem.title}</div>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="p-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
              >
                {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            <aside
              className={`${
                mobileSidebarOpen ? 'block' : 'hidden'
              } md:block w-full md:w-80 flex-shrink-0 bg-slate-900/70 border-r border-slate-800 overflow-y-auto`}
            >
              <div className="p-4 border-b border-slate-800 space-y-3">
                <select
                  value={selectedCourseId}
                  onChange={(e) => handleEnrollAndOpen(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-white focus:outline-none"
                >
                  {coursesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 space-y-2">
                {currentCourse.modules.map((mod) => {
                  const isOpen = !!openModules[mod.id];
                  return (
                    <div key={mod.id} className="rounded-xl border border-slate-800/90 bg-slate-950/50 overflow-hidden">
                      <button
                        onClick={() => setOpenModules((prev) => ({ ...prev, [mod.id]: !prev[mod.id] }))}
                        className="w-full px-3.5 py-3 text-left flex items-center justify-between gap-2 hover:bg-slate-900/80 transition-colors cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-200 leading-snug">{mod.title}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-2 pb-2 space-y-1 border-t border-slate-900 pt-1.5">
                          {mod.items.map((item) => {
                            const isSelected = item.id === currentItem.id;
                            const isDone = completedItems.includes(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  selectLessonItem(item.id);
                                  setMobileSidebarOpen(false);
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.type === 'theory' ? (
                                    <BookOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  ) : (
                                    <Terminal className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{item.title}</span>
                                </div>
                                {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            <div className="flex-1 overflow-y-auto">
              {currentItem.type === 'theory' ? (
                <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-8">
                  <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
                    <MarkdownRenderer markdown={currentItem.content} />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={goToNextItem}
                      className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Отметить как изученное (+50 XP) и перейти далее</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 min-h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                  <div className="p-6 space-y-6 overflow-y-auto">
                    <MarkdownRenderer markdown={currentItem.content} />

                    {currentItem.tests && (
                      <div className="space-y-2.5 pt-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Тестовые примеры (Stdin → Stdout)
                        </h4>
                        <div className="grid grid-cols-1 gap-2.5">
                          {currentItem.tests.map((t: TestCase, idx: number) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
                              <div>
                                <div className="text-slate-500 mb-1">Ввод #{idx + 1}:</div>
                                <pre className="text-slate-200 whitespace-pre-wrap">{t.input}</pre>
                              </div>
                              <div>
                                <div className="text-slate-500 mb-1">Ожидаемый ответ:</div>
                                <pre className="text-emerald-400 whitespace-pre-wrap">{t.expected}</pre>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => setShowSolution(!showSolution)}
                        className="text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
                      >
                        {showSolution ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-blue-400" />}
                        <span>{showSolution ? 'Скрыть эталонное решение' : 'Показать эталонное решение'}</span>
                      </button>

                      {showSolution && (
                        <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                          <pre className="text-xs font-mono text-emerald-300 overflow-x-auto">
                            <code>{currentItem.solution}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 flex flex-col gap-4 bg-slate-950/60">
                    <div className="flex-1 min-h-[260px]">
                      <CodeEditor
                        code={currentCode}
                        onChange={handleCodeChange}
                        language={currentCourse.language}
                        onReset={() => handleCodeChange(currentItem.initialCode || '')}
                        onFillSolution={() => handleCodeChange(currentItem.solution || '')}
                        onRun={handleRunTaskTests}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={handleRunTaskTests}
                        disabled={isRunningTests}
                        className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{isRunningTests ? 'Выполнение тестов...' : 'Запустить тесты'}</span>
                      </button>

                      {(allTestsPassed || completedItems.includes(currentItem.id)) && (
                        <button
                          onClick={goToNextItem}
                          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Задача решена (+50 XP • Далее)</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="rounded-xl bg-[#090d16] border border-slate-800 overflow-hidden">
                      <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-mono flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          Терминал проверки тестов
                        </span>
                        {testResults && testResults[0] && (
                          <span className="text-[11px] font-mono text-slate-500">Среда: {testResults[0].engine}</span>
                        )}
                      </div>

                      <div className="p-4 font-mono text-xs space-y-2.5 max-h-60 overflow-y-auto">
                        {!testResults && !isRunningTests && (
                          <div className="text-slate-500">
                            Нажмите «Запустить тесты», чтобы скомпилировать код и сверить ответы.
                          </div>
                        )}

                        {isRunningTests && (
                          <div className="text-blue-400 flex items-center gap-2">
                            <Cpu className="w-4 h-4 animate-spin" />
                            <span>Компиляция и прогон тестовых сценариев...</span>
                          </div>
                        )}

                        {testResults && testResults[0]?.engine === 'Local Sandbox' && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                              Облачный компилятор недоступен — код проверен упрощённым локальным симулятором, результат
                              приблизительный.
                            </span>
                          </div>
                        )}

                        {testResults &&
                          testResults.map((r: TestResult) => (
                            <div
                              key={r.index}
                              className={`p-3 rounded-lg border ${
                                r.passed
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                  : 'bg-rose-950/25 border-rose-500/30 text-rose-200'
                              }`}
                            >
                              <div className="font-bold flex items-center justify-between">
                                <span>{r.passed ? `Тест ${r.index}: Успех ✅` : `Тест ${r.index}: Ошибка ❌`}</span>
                                <span className="text-[11px] opacity-75">Ввод: {JSON.stringify(r.input)}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-slate-300">
                                Ожидалось: <span className="text-emerald-400 font-semibold">{r.expected}</span> | Получено:{' '}
                                <span className={r.passed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                  {r.actual}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'certificate' && (
          <CertificateView
            course={currentCourse}
            studentName={studentName}
            setStudentName={setStudentName}
            isCompleted={getCourseProgress(currentCourse).percent === 100}
            onBackToLearn={() => setActiveTab('learn')}
          />
        )}
      </main>

      {activeTab !== 'learn' && (
        <nav
          aria-label="Мобильная навигация"
          className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.08] bg-slate-950/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="grid grid-cols-5">
            {navItems.map((nav) => {
              const Icon = nav.icon;
              const active = activeTab === nav.id;
              return (
                <li key={nav.id}>
                  <button
                    onClick={() => setActiveTab(nav.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors cursor-pointer ${
                      active ? 'text-blue-300' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span
                      className={`grid place-items-center w-10 h-6 rounded-full transition-colors ${
                        active ? 'bg-blue-600/25' : ''
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    {nav.short}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}