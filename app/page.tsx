"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { OnMount } from '@monaco-editor/react';
import { computeSmartEnter, computeToggleComment, LINE_COMMENT, type EditorLang } from '@/lib/editor-commands';
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
  translateAuthError,
  getPasswordStrength,
  mergeGuestToCloud,
  validateNewPassword,
  isValidEmail,
  createGuestProfile,
  parseCloudAccount,
  isNetworkError,
  type UserAccount,
  type LocalProfile,
  type AuthMode,
  type SyncStatus,
  MIN_PASSWORD_LENGTH,
  PENDING_SYNC_KEY,
  LOCAL_DATA_KEYS,
  DEFAULT_NAME,
  DEFAULT_AVATAR,
  DEFAULT_COURSES
} from '@/lib/auth-utils';
import { sendEmailViaEmailJS, translateEmailError, RESEND_COOLDOWN_SEC } from '@/lib/email';
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
  RotateCcw,
  Copy,
  Check,
  Download,
  Layers,
  Cpu,
  FileCode,
  ArrowRight,
  Menu,
  X,
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
  Compass,
  Medal,
  Crown,
  Lock,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  CloudOff,
  CloudUpload,
  Trash2,
  Users,
  ThumbsUp,
  Clock,
  Upload,
  Loader2
} from 'lucide-react';
import {
  fetchCloudSolutions,
  getLocalSolutions,
  getOwnSolution,
  isOwnSynced,
  publishSolution,
  toggleLike,
  readLikedIds,
  mergeSolutions,
  sortSolutions,
  formatRelativeTime,
  pluralRu,
  countChars,
  isSameCode,
  type CommunitySolution,
  type SolutionSort
} from '@/lib/community-solutions';

// --- ТИПЫ ДАННЫХ TYPESCRIPT ---

export interface TestCase {
  input: string;
  expected: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface CourseItem {
  id: string;
  title: string;
  type: 'theory' | 'task' | 'quiz';
  content: string;
  initialCode?: string;
  solution?: string;
  tests?: TestCase[];
  quizQuestions?: QuizQuestion[];
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

export type { UserAccount };

type TabType =
  | 'dashboard'
  | 'catalog'
  | 'my-learning'
  | 'certificates'
  | 'profile'
  | 'learn'
  | 'certificate';

const AVATAR_OPTIONS: string[] = ['👨‍💻', '🚀', '⚡', '🤖', '🦊', '🔥', '💎', '🎓'];

/** Безопасный разбор строки user_accounts: null, если строка пустая или битая. */
function toAccount(row: unknown): UserAccount | null {
  if (!row) return null;
  try {
    return parseCloudAccount(row);
  } catch {
    return null;
  }
}

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

  // --- Уровень 1: Собственный сервер (NEXT_PUBLIC_RUN_URL) ---
  if (RUN_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
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
      // Переходим к следующему уровню
    }
  }

  // --- Уровень 2: Godbolt Compiler Explorer (CORS-совместимый, работает в РФ) ---
  try {
    const godboltCompiler = langKey === 'cpp' ? 'g132' : 'python311';
    const godboltUrl = `https://godbolt.org/api/compiler/${godboltCompiler}/compile`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(godboltUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        source: cleanCode,
        options: {
          // -fdiagnostics-color=never: без цветовых escape-кодов в тексте ошибок
          userArguments: langKey === 'cpp' ? '-O2 -std=c++20 -fdiagnostics-color=never' : '',
          executeParameters: { args: [], stdin: stdinInput },
          compilerOptions: { executorRequest: true },
          filters: { execute: true }
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data: {
        code?: number;
        stdout?: Array<{ text: string }>;
        stderr?: Array<{ text: string }>;
        buildResult?: { stderr?: Array<{ text: string }> };
      } = await response.json();
      const buildStderr = (data.buildResult?.stderr ?? []).map((x) => x.text).join('\n').trim();
      if (data.code !== 0 && buildStderr) {
        return { stdout: '', stderr: buildStderr, engine: 'Cloud Compiler (Godbolt)' };
      }
      const stdout = (data.stdout ?? []).map((x) => x.text).join('\n').trim();
      const stderr = (data.stderr ?? []).map((x) => x.text).join('\n').trim();
      return { stdout, stderr, engine: 'Cloud Compiler (Godbolt)' };
    }
  } catch {
    // Переходим к следующему уровню
  }

  // --- Уровень 3: Wandbox (открытый облачный компилятор с CORS) ---
  try {
    const wandboxCompiler = langKey === 'cpp' ? 'gcc-head' : 'cpython-head';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: wandboxCompiler, code: cleanCode, stdin: stdinInput }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data: {
        status?: string;
        program_output?: string;
        program_error?: string;
        compiler_error?: string;
      } = await response.json();
      const compileErr = (data.compiler_error || '').trim();
      const programErr = (data.program_error || '').trim();
      if (data.status !== '0' && (compileErr || programErr)) {
        return { stdout: '', stderr: compileErr || programErr, engine: 'Cloud Compiler (Wandbox)' };
      }
      return {
        stdout: (data.program_output || '').trim(),
        stderr: '',
        engine: 'Cloud Compiler (Wandbox)'
      };
    }
  } catch {
    // Переходим к следующему уровню
  }

  // --- Уровень 4: Piston API + умный локальный фоллбэк ---
  try {
    const pistonLang = langKey === 'cpp' ? 'cpp' : 'python';
    const pistonFile = langKey === 'cpp' ? 'main.cpp' : 'main.py';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang,
        version: '*',
        files: [{ name: pistonFile, content: cleanCode }],
        stdin: stdinInput
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data: {
        run?: { stdout?: string; stderr?: string; code?: number };
        compile?: { stderr?: string; code?: number };
        message?: string;
      } = await response.json();
      if (data.message?.includes('whitelist')) throw new Error('whitelist');
      const compileStderr = (data.compile?.stderr || '').trim();
      if (data.compile?.code && data.compile.code !== 0 && compileStderr) {
        return { stdout: '', stderr: compileStderr, engine: 'Cloud Compiler (Piston)' };
      }
      return {
        stdout: (data.run?.stdout || '').trim(),
        stderr: (data.run?.stderr || '').trim(),
        engine: 'Cloud Compiler (Piston)'
      };
    }
  } catch {
    // Все облачные компиляторы недоступны — используем локальный симулятор
  }

  // Умный локальный симулятор (всегда доступен, работает в любой сети)
  return simulateLocalExecution(langKey, cleanCode, stdinInput, taskId, expectedOutput, referenceSolution);
}

function simulateLocalExecution(
  langKey: 'cpp' | 'python',
  code: string,
  stdinInput: string,
  taskId: string,
  expectedOutput: string,
  referenceSolution?: string
): ExecutionResult {
  // Нормализация кода: убираем комментарии, лишние пробелы, std::, endl→\n
  const stripCode = (src: string): string => {
    if (langKey === 'cpp') {
      return src
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/std::/g, '')
        .replace(/endl/g, '"\\n"')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return src
      .replace(/#.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const stripped = stripCode(code);

  // --- Сравнение с эталонным решением (нормализованное) ---
  // Выполняется ДО синтаксических проверок, чтобы «Подставить решение» всегда проходило
  if (referenceSolution) {
    const normalizedUser = stripped;
    const normalizedRef = stripCode(referenceSolution);
    if (normalizedUser === normalizedRef) {
      return { stdout: expectedOutput, stderr: '', engine: 'Local Sandbox' };
    }
  }

  // --- Базовые синтаксические проверки ---
  if (langKey === 'cpp') {
    if (!stripped.includes('main')) {
      return { stdout: '', stderr: 'error: undefined reference to `main`', engine: 'Local Sandbox' };
    }
    if (!stripped.includes('cout') && !stripped.includes('printf')) {
      return { stdout: '', stderr: 'Предупреждение: программа ничего не выводит в cout.', engine: 'Local Sandbox' };
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
    const hasAddition = /\+\s*b|a\s*\+|sum\s*=|cout\s*<<\s*\(?\s*a\s*\+\s*b/.test(stripped);
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
      stripped.includes('max') ||
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

  return { stdout: '', stderr: '', engine: 'Local Sandbox' };
}

/**
 * Убирает ANSI-последовательности цвета (ESC[01;31m и т.п.), которые GCC добавляет в диагностику.
 * Браузер не интерпретирует их, и пользователь видит мусор вида «[01m[K».
 */
function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '');
}

function normalizeOutput(text: string): string {
  return stripAnsi(text)
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
      actual: res.stderr ? `Ошибка: ${stripAnsi(res.stderr).trim()}` : actual || '(пустой вывод)',
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
  onRun?: () => void;
}

// Monaco Editor загружается динамически (нет SSR), чтобы не сломать next/static-export
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full min-h-[240px] bg-[#0d1117] animate-pulse rounded-b-xl flex items-center justify-center">
      <span className="text-slate-600 text-xs font-mono">Загрузка редактора...</span>
    </div>
  )
});

// Типы редактора и API Monaco берём из сигнатуры onMount — без any и без прямой зависимости от monaco-editor
type StandaloneEditor = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];
type EditorEdit = Parameters<StandaloneEditor['executeEdits']>[1][number];

const EDITOR_FONT_SIZES = [12, 14, 16] as const;
type EditorFontSize = (typeof EDITOR_FONT_SIZES)[number];
const EDITOR_FONT_SIZE_KEY = 'dc_editor_font_size';
const DEFAULT_EDITOR_FONT_SIZE: EditorFontSize = 14;
const isEditorFontSize = (v: number): v is EditorFontSize => (EDITOR_FONT_SIZES as readonly number[]).includes(v);

// Мини-стор для useSyncExternalStore: localStorage + уведомление подписчиков
const fontSizeListeners = new Set<() => void>();
// Запасное значение в памяти — если localStorage недоступен (инкогнито, запрет хранилища)
let memoryFontSize: EditorFontSize = DEFAULT_EDITOR_FONT_SIZE;
const readFontSize = (): EditorFontSize => {
  const saved = Number(safeGet(EDITOR_FONT_SIZE_KEY));
  return isEditorFontSize(saved) ? saved : memoryFontSize;
};
const writeFontSize = (size: EditorFontSize) => {
  memoryFontSize = size;
  safeSet(EDITOR_FONT_SIZE_KEY, String(size));
  fontSizeListeners.forEach((notify) => notify());
};
const subscribeFontSize = (notify: () => void) => {
  fontSizeListeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key === EDITOR_FONT_SIZE_KEY) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    fontSizeListeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
};

/** Умный Enter: отступ +4 после `{` (C++) или `:` (Python); иначе — стандартный Enter Monaco. */
function applySmartEnter(editor: StandaloneEditor, monaco: MonacoApi, lang: EditorLang) {
  const model = editor.getModel();
  const selections = editor.getSelections();
  const fallback = () => editor.trigger('keyboard', 'type', { text: '\n' });
  // Мультикурсор оставляем стандартной логике
  if (!model || !selections || selections.length !== 1) {
    fallback();
    return;
  }

  const sel = selections[0];
  const before = model.getLineContent(sel.startLineNumber).slice(0, sel.startColumn - 1);
  const after = model.getLineContent(sel.endLineNumber).slice(sel.endColumn - 1);
  const result = computeSmartEnter(lang, before, after);
  if (!result) {
    fallback();
    return;
  }

  const range = new monaco.Range(
    sel.startLineNumber,
    sel.startColumn,
    sel.endLineNumber,
    sel.endColumn + result.deleteAfter
  );
  const cursorLine = sel.startLineNumber + 1;
  editor.pushUndoStop();
  editor.executeEdits('smart-enter', [{ range, text: result.text, forceMoveMarkers: true }], [
    new monaco.Selection(cursorLine, result.cursorColumn, cursorLine, result.cursorColumn)
  ]);
  editor.pushUndoStop();
  editor.revealLine(cursorLine);
}

/** Ctrl + / — комментирует/раскомментирует строки под каждым курсором или выделением. */
function applyToggleComment(editor: StandaloneEditor, monaco: MonacoApi, lang: EditorLang) {
  const model = editor.getModel();
  const selections = editor.getSelections();
  if (!model || !selections) return;

  const edits: EditorEdit[] = [];
  const seenLines = new Set<number>();

  for (const sel of selections) {
    let endLine = sel.endLineNumber;
    // Выделение, заканчивающееся в начале строки, эту строку не захватывает
    if (endLine > sel.startLineNumber && sel.endColumn === 1) endLine -= 1;

    const lineNumbers: number[] = [];
    for (let ln = sel.startLineNumber; ln <= endLine; ln++) {
      if (!seenLines.has(ln)) {
        seenLines.add(ln);
        lineNumbers.push(ln);
      }
    }
    const lines = lineNumbers.map((ln) => model.getLineContent(ln));

    for (const e of computeToggleComment(lang, lines)) {
      const ln = lineNumbers[e.lineIndex];
      edits.push({ range: new monaco.Range(ln, e.column, ln, e.column + e.deleteLength), text: e.insert });
    }
  }

  if (edits.length === 0) return;
  editor.pushUndoStop();
  editor.executeEdits('toggle-comment', edits);
  editor.pushUndoStop();
}

function CodeEditor({ code, onChange, language, onReset, onRun }: CodeEditorProps) {
  // Monaco использует имя языка в формате его API
  const monacoLang: EditorLang = language === 'C++' ? 'cpp' : 'python';
  const fileName = language === 'C++' ? 'main.cpp (C++17)' : 'solution.py (Python 3)';
  const commentToken = LINE_COMMENT[monacoLang];

  const editorRef = useRef<StandaloneEditor | null>(null);
  // Команды регистрируются один раз при монтировании, поэтому актуальные язык и onRun читаем из рефов
  const langRef = useRef<EditorLang>(monacoLang);
  const onRunRef = useRef<(() => void) | undefined>(onRun);
  useEffect(() => {
    langRef.current = monacoLang;
    onRunRef.current = onRun;
  }, [monacoLang, onRun]);

  // --- Размер шрифта (сохраняется в localStorage, синхронизируется между вкладками) ---
  const fontSize = useSyncExternalStore(subscribeFontSize, readFontSize, () => DEFAULT_EDITOR_FONT_SIZE);
  const handleFontSize = (size: EditorFontSize) => writeFontSize(size);

  // --- Копирование всего кода ---
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );
  const handleCopyAll = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API недоступен');
      await navigator.clipboard.writeText(editorRef.current?.getValue() ?? code);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleEditorDidMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;

      // Тема: адаптируем vs-dark под цветовую схему приложения
      monaco.editor.defineTheme('dev-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
          { token: 'keyword', foreground: '60a5fa', fontStyle: 'bold' },
          { token: 'string', foreground: 'a5f3fc' },
          { token: 'number', foreground: 'fbbf24' },
          { token: 'type', foreground: '34d399' },
          { token: 'function', foreground: '818cf8' },
          { token: 'variable', foreground: 'e2e8f0' },
          { token: 'operator', foreground: '94a3b8' },
          { token: 'delimiter', foreground: '94a3b8' },
          { token: 'identifier', foreground: 'e2e8f0' },
        ],
        colors: {
          'editor.background': '#0d1117',
          'editor.foreground': '#e2e8f0',
          'editorLineNumber.foreground': '#374151',
          'editorLineNumber.activeForeground': '#60a5fa',
          'editor.lineHighlightBackground': '#ffffff08',
          'editor.selectionBackground': '#3b82f640',
          'editor.inactiveSelectionBackground': '#3b82f620',
          'editorCursor.foreground': '#60a5fa',
          'editorWhitespace.foreground': '#1f2937',
          'editorIndentGuide.background': '#1f2937',
          'editorIndentGuide.activeBackground': '#374151',
          'editorBracketMatch.background': '#3b82f630',
          'editorBracketMatch.border': '#3b82f6',
          'scrollbar.shadow': '#00000000',
          'scrollbarSlider.background': '#ffffff10',
          'scrollbarSlider.hoverBackground': '#ffffff18',
          'scrollbarSlider.activeBackground': '#ffffff25',
          'editorWidget.background': '#111827',
          'editorWidget.border': '#1f2937',
          'editorSuggestWidget.background': '#111827',
          'editorSuggestWidget.border': '#1f2937',
          'editorSuggestWidget.selectedBackground': '#1e3a5f',
          'editorHoverWidget.background': '#111827',
          'editorHoverWidget.border': '#1f2937',
        }
      });
      monaco.editor.setTheme('dev-dark');

      // Ctrl+Enter — запуск тестов
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onRunRef.current?.();
      });

      // Умный Enter. Когда открыт список подсказок, Enter принимает подсказку, как обычно
      editor.addCommand(
        monaco.KeyCode.Enter,
        () => applySmartEnter(editor, monaco, langRef.current),
        '!suggestWidgetVisible && !editorReadonly'
      );

      // Ctrl + / (и Ctrl + / на цифровом блоке) — переключение комментария
      const toggleComment = () => applyToggleComment(editor, monaco, langRef.current);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, toggleComment);
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadDivide, toggleComment);

      // Автофокус при загрузке
      editor.focus();
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Титульная полоса */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <FileCode className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-mono text-slate-300 font-medium">{fileName}</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-semibold border border-blue-500/25">
            Monaco
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden lg:inline text-[11px] text-slate-500">
            {onRun && 'Ctrl+Enter — запуск · '}Ctrl+/ — {commentToken} комментарий
          </span>

          {/* Размер шрифта */}
          <div
            role="group"
            aria-label="Размер шрифта редактора"
            className="flex items-center rounded-lg bg-slate-800/80 p-0.5"
          >
            {EDITOR_FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleFontSize(size)}
                aria-pressed={fontSize === size}
                aria-label={`Размер шрифта ${size} пикселей`}
                className={`text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  fontSize === size ? 'bg-blue-500/25 text-blue-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {size}px
              </button>
            ))}
          </div>

          {/* Копировать весь код */}
          <button
            type="button"
            onClick={handleCopyAll}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              copyStatus === 'copied'
                ? 'bg-emerald-500/15 text-emerald-300'
                : copyStatus === 'error'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {copyStatus === 'copied' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span aria-live="polite">
              {copyStatus === 'copied' ? 'Скопировано' : copyStatus === 'error' ? 'Не удалось' : 'Копировать весь код'}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-[260px]">
        <MonacoEditor
          height="100%"
          defaultLanguage={monacoLang}
          language={monacoLang}
          value={code}
          theme="dev-dark"
          onChange={(val) => onChange(val ?? '')}
          onMount={handleEditorDidMount}
          options={{
            fontSize,
            fontFamily: 'var(--font-jetbrains), "JetBrains Mono", "Fira Code", Menlo, monospace',
            fontLigatures: true,
            lineHeight: Math.round(fontSize * 1.7),
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            contextmenu: false,
            quickSuggestions: { other: true, comments: false, strings: false },
            parameterHints: { enabled: true },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'smart',
            snippetSuggestions: 'inline',
            formatOnPaste: true,
            formatOnType: false,
            // Автозакрытие ( { [ " ' : закрывающий символ подставляется, курсор встаёт между ними
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoClosingOvertype: 'always',
            autoClosingDelete: 'always',
            autoSurround: 'languageDefined',
            autoIndent: 'full',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 16, bottom: 16 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
              useShadows: false,
            },
            glyphMargin: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderWhitespace: 'none',
          }}
        />
      </div>
    </div>
  );
}

type CertificateTier = 'none' | 'silver' | 'gold';

function getCertificateTier(percent: number): CertificateTier {
  if (percent >= 100) return 'gold';
  if (percent >= 80) return 'silver';
  return 'none';
}

interface CourseMilestoneProgressBarProps {
  percent: number;
  accent?: string;
  className?: string;
  compact?: boolean;
  showLabels?: boolean;
}

function CourseMilestoneProgressBar({
  percent,
  accent = 'from-blue-500 to-emerald-400',
  className = '',
  compact = false,
  showLabels = true
}: CourseMilestoneProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const isSilver = clamped >= 80;
  const isGold = clamped >= 100;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Шкала с двумя контрольными точками */}
      <div className="relative pt-2 pb-2">
        <div className={`w-full ${compact ? 'h-2' : 'h-2.5'} rounded-full bg-slate-950/80 border border-slate-800 overflow-hidden relative`}>
          <div
            className={`h-full bg-gradient-to-r ${accent} transition-all duration-500`}
            style={{ width: `${clamped}%` }}
          />
        </div>

        {/* 80% Контрольная точка: Серебряная метка (Сертификат хорошиста) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex flex-col items-center cursor-default"
          style={{ left: '80%' }}
          title="80% — Порог получения «Сертификата хорошиста»"
        >
          <div
            className={`flex items-center justify-center rounded-full transition-all duration-300 ${
              compact ? 'w-4 h-4' : 'w-5 h-5'
            } ${
              isSilver
                ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 border border-white shadow-[0_0_8px_rgba(203,213,225,0.7)] scale-110'
                : 'bg-slate-900 text-slate-500 border border-slate-700'
            }`}
          >
            <Medal className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          </div>
        </div>

        {/* 100% Контрольная точка: Золотая метка (Диплом с отличием) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 right-0 z-10 flex flex-col items-center cursor-default"
          title="100% — Порог получения «Диплома с отличием»"
        >
          <div
            className={`flex items-center justify-center rounded-full transition-all duration-300 ${
              compact ? 'w-4 h-4' : 'w-5 h-5'
            } ${
              isGold
                ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 border border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.8)] scale-110'
                : 'bg-slate-900 text-amber-500/50 border border-amber-900/60'
            }`}
          >
            <Crown className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          </div>
        </div>
      </div>

      {/* Метки и пояснения рубежей */}
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>Прогресс: {clamped}%</span>
            {isGold ? (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-sans font-semibold flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> Отличие
              </span>
            ) : isSilver ? (
              <span className="px-1.5 py-0.2 rounded bg-slate-300/15 text-slate-200 border border-slate-300/30 text-[10px] font-sans font-semibold flex items-center gap-1">
                <Medal className="w-2.5 h-2.5" /> Хорошист
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <span className={`flex items-center gap-0.5 ${isSilver ? 'text-slate-200 font-semibold' : 'text-slate-500'}`} title="80% — Сертификат хорошиста">
              <Medal className="w-2.5 h-2.5" /> 80%
            </span>
            <span className="text-slate-700">•</span>
            <span className={`flex items-center gap-0.5 ${isGold ? 'text-amber-300 font-semibold' : 'text-slate-500'}`} title="100% — Диплом с отличием">
              <Crown className="w-2.5 h-2.5" /> 100%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface CertificateViewProps {
  course: Course;
  studentName: string;
  setStudentName: React.Dispatch<React.SetStateAction<string>>;
  progressPercent: number;
  onBackToLearn: () => void;
}

function CertificateView({ course, studentName, setStudentName, progressPercent, onBackToLearn }: CertificateViewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const tier = getCertificateTier(progressPercent);
  const isGold = tier === 'gold';
  const isEligible = tier !== 'none';

  const issueDate = useMemo(() => {
    return new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }, []);

  const certId = useMemo(() => {
    const prefix = course.langKey.toUpperCase();
    const tierTag = isGold ? 'GOLD' : 'SLV';
    const hash = Math.abs(course.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) * 7919)
      .toString()
      .slice(0, 6);
    return `DC-${prefix}-${tierTag}-2026-${hash}`;
  }, [course, isGold]);

  const handleDownloadCertificate = () => {
    if (!isEligible) return;
    setIsDownloading(true);
    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1414;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Фон сертификата: Золотой или Серебряно-голубой
        const bgGrad = ctx.createLinearGradient(0, 0, 2000, 1414);
        if (isGold) {
          bgGrad.addColorStop(0, '#020617');
          bgGrad.addColorStop(0.5, '#0f172a');
          bgGrad.addColorStop(1, '#1e1b4b');
        } else {
          bgGrad.addColorStop(0, '#020617');
          bgGrad.addColorStop(0.5, '#0b192c');
          bgGrad.addColorStop(1, '#1e293b');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 2000, 1414);

        // Рамки
        ctx.strokeStyle = isGold ? '#3b82f6' : '#64748b';
        ctx.lineWidth = 6;
        ctx.strokeRect(70, 70, 1860, 1274);

        ctx.strokeStyle = isGold ? '#eab308' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(92, 92, 1816, 1230);

        ctx.textAlign = 'center';
        ctx.fillStyle = isGold ? '#60a5fa' : '#38bdf8';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('DEVCOURSES • ОБРАЗОВАТЕЛЬНАЯ ПЛАТФОРМА', 1000, 210);

        // Заголовок в зависимости от уровня
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 74px serif';
        ctx.fillText(isGold ? 'ДИПЛОМ С ОТЛИЧИЕМ' : 'СЕРТИФИКАТ ХОРОШИСТА', 1000, 315);

        ctx.fillStyle = isGold ? '#fbbf24' : '#94a3b8';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(
          isGold
            ? '★ HIGH HONORS GOLD • НАИВЫСШАЯ СТЕПЕНЬ ОТЛИЧИЯ ★'
            : '★ SILVER PASS • ОКОНЧЕНО С ХОРОШИМИ РЕЗУЛЬТАТАМИ ★',
          1000,
          365
        );

        ctx.fillStyle = '#94a3b8';
        ctx.font = '30px sans-serif';
        ctx.fillText('Настоящим подтверждается, что', 1000, 445);

        const fitFont = (text: string, template: (size: number) => string, maxWidth: number, start: number, min: number) => {
          let size = start;
          ctx.font = template(size);
          while (ctx.measureText(text).width > maxWidth && size > min) {
            size -= 2;
            ctx.font = template(size);
          }
        };

        const displayName = (studentName || 'Иван Иванов').trim();
        ctx.fillStyle = isGold ? '#fbbf24' : '#f1f5f9';
        fitFont(displayName, (sz) => `italic bold ${sz}px serif`, 1500, 84, 36);
        ctx.fillText(displayName, 1000, 565);

        ctx.strokeStyle = isGold ? 'rgba(251, 191, 36, 0.4)' : 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(500, 605);
        ctx.lineTo(1500, 605);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '30px sans-serif';
        const descText = isGold
          ? 'с отличием освоил(а) теоретический материал и успешно решил(а) 100% практических задач курса'
          : `успешно освоил(а) программу курса и решил(а) ключевые практические задачи (прогресс ${progressPercent}%)`;
        ctx.fillText(descText, 1000, 690);

        ctx.fillStyle = isGold ? '#38bdf8' : '#60a5fa';
        const courseLabel = `«${course.title}»`;
        fitFont(courseLabel, (sz) => `bold ${sz}px sans-serif`, 1700, 56, 28);
        ctx.fillText(courseLabel, 1000, 785);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '26px sans-serif';
        const levelDetail = isGold
          ? `Язык: ${course.language} • Уровень: ${course.level} • Выполнено 100% программы (Золотой уровень)`
          : `Язык: ${course.language} • Уровень: ${course.level} • Прогресс: ${progressPercent}% (Серебряный уровень)`;
        ctx.fillText(levelDetail, 1000, 855);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px sans-serif';
        ctx.fillText('Дата выдачи:', 180, 1140);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(issueDate, 180, 1180);

        // Печать в центре бланка
        ctx.save();
        ctx.beginPath();
        ctx.arc(1000, 1150, 70, 0, Math.PI * 2);
        ctx.fillStyle = isGold ? 'rgba(234, 179, 8, 0.12)' : 'rgba(148, 163, 184, 0.12)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = isGold ? '#eab308' : '#94a3b8';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = isGold ? '#fbbf24' : '#e2e8f0';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(isGold ? '100% PASS' : `${progressPercent}% PASS`, 1000, 1145);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = isGold ? '#f59e0b' : '#94a3b8';
        ctx.fillText(isGold ? 'GOLD HONORS' : 'SILVER TIER', 1000, 1175);
        ctx.restore();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px sans-serif';
        ctx.fillText('ID документа:', 1820, 1140);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(certId, 1820, 1180);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${isGold ? 'diploma-gold' : 'certificate-silver'}-${course.id}.png`;
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

        {!isEligible ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Предпросмотр: ваш прогресс {progressPercent}%. Пройдите минимум 80% курса для получения сертификата!</span>
          </div>
        ) : !isGold ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs sm:text-sm">
            <Medal className="w-4 h-4 flex-shrink-0 text-slate-300" />
            <span>Вам доступен «Сертификат хорошиста» (прогресс {progressPercent}%). Завершите 100%, чтобы получить «Диплом с отличием»!</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm">
            <Crown className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>Наивысшая степень отличия: вам присвоен «Диплом с отличием» (100% прохождение)!</span>
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
          disabled={isDownloading || !isEligible}
          title={!isEligible ? 'Пройдите минимум 80% курса для получения сертификата' : undefined}
          className={`px-6 py-3.5 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 transition-all ${
            !isEligible
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
              : isGold
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/25 cursor-pointer font-bold'
              : 'bg-gradient-to-r from-slate-200 to-slate-400 hover:from-white hover:to-slate-300 text-slate-950 shadow-slate-300/25 cursor-pointer font-bold'
          }`}
        >
          <Download className="w-5 h-5" />
          <span>
            {isDownloading
              ? 'Генерация PNG...'
              : downloadSuccess
              ? 'Документ скачан! ✅'
              : !isEligible
              ? 'Заблокировано (нужно 80% курса)'
              : isGold
              ? 'Скачать диплом с отличием (PNG)'
              : 'Скачать сертификат хорошиста (PNG)'}
          </span>
        </button>
      </div>

      {/* Интерактивный бланк документа */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl p-1 shadow-2xl transition-all ${
          isGold
            ? 'bg-gradient-to-br from-blue-500 via-amber-400 to-emerald-500'
            : 'bg-gradient-to-br from-slate-400 via-blue-400 to-cyan-500'
        }`}
      >
        <div
          className={`relative rounded-xl p-6 sm:p-12 md:p-16 text-center space-y-6 ${
            isGold
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-4 border-double border-amber-400/40'
              : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-4 border-double border-blue-400/40'
          }`}
        >
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-semibold ${
              isGold
                ? 'bg-amber-500/10 border border-amber-400/30 text-amber-300'
                : 'bg-blue-500/10 border border-blue-400/30 text-blue-300'
            }`}
          >
            {isGold ? <Crown className="w-4 h-4 text-amber-400" /> : <Medal className="w-4 h-4 text-slate-300" />}
            <span>{isGold ? 'DevCourses • Honors Diploma (Gold)' : 'DevCourses • Silver Certificate (Good Standing)'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-wide">
            {isGold ? 'ДИПЛОМ С ОТЛИЧИЕМ' : 'СЕРТИФИКАТ ХОРОШИСТА'}
          </h1>

          <p className="text-slate-400 text-sm sm:text-base">Настоящим подтверждается, что</p>

          <div className="py-2">
            <div
              className={`inline-block px-8 pb-3 text-2xl sm:text-4xl md:text-5xl font-serif italic font-bold ${
                isGold
                  ? 'text-amber-300 border-b-2 border-amber-400/50'
                  : 'text-slate-100 border-b-2 border-slate-400/50'
              }`}
            >
              {studentName.trim() || 'Иван Иванов'}
            </div>
          </div>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            {isGold
              ? 'с отличием завершил(а) полную теоретическую и практическую программу курса, решив 100% алгоритмических задач'
              : `успешно освоил(а) программу курса и решил(а) ключевые практические алгоритмические задачи (прогресс ${progressPercent}%)`}
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
              <div
                className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center ${
                  isGold
                    ? 'border-amber-400/70 bg-amber-400/10 text-amber-300'
                    : 'border-slate-300/70 bg-slate-400/10 text-slate-200'
                }`}
              >
                {isGold ? <Crown className="w-6 h-6 mb-0.5" /> : <Medal className="w-6 h-6 mb-0.5 text-slate-300" />}
                <span className="text-[10px] font-bold tracking-wider uppercase">
                  {isGold ? '100% GOLD' : `${progressPercent}% SILVER`}
                </span>
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

// --- ИНТЕРАКТИВНЫЙ ТЕСТ (КВИЗ) ---

interface QuizQuestionCardProps {
  index: number;
  question: QuizQuestion;
  selected: number | undefined;
  onSelect: (optIdx: number) => void;
}

function QuizQuestionCard({ index, question: q, selected, onSelect }: QuizQuestionCardProps) {
  const answered = selected !== undefined;
  const correct = selected === q.correctIndex;

  return (
    <li
      className={`p-5 rounded-2xl border shadow-lg transition-colors ${
        correct
          ? 'bg-emerald-950/15 border-emerald-500/30'
          : answered
            ? 'bg-rose-950/10 border-rose-500/25'
            : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-white mb-3 flex gap-2">
          <span className="text-violet-300 font-mono">{index + 1}.</span>
          <span>{q.question}</span>
        </legend>

        <div className="grid grid-cols-1 gap-2">
          {q.options.map((opt, optIdx) => {
            const isSelected = selected === optIdx;
            const showCorrect = correct && optIdx === q.correctIndex;
            const showWrong = isSelected && !correct;
            return (
              <button
                key={optIdx}
                type="button"
                onClick={() => onSelect(optIdx)}
                disabled={correct}
                aria-pressed={isSelected}
                className={`w-full px-4 py-3 rounded-xl border text-left text-sm flex items-center justify-between gap-3 transition-colors ${
                  showCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold'
                    : showWrong
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                      : correct
                        ? 'bg-slate-950/50 border-slate-800 text-slate-500'
                        : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-violet-500/50 hover:bg-slate-900 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border border-current grid place-items-center text-[11px] font-mono flex-shrink-0">
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span>{opt}</span>
                </span>
                {showCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                {showWrong && <X className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div
            role="status"
            className={`p-3 rounded-xl text-xs leading-relaxed border ${
              correct
                ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
                : 'bg-rose-950/30 border-rose-500/20 text-rose-200'
            }`}
          >
            <div className="font-bold mb-1">
              {correct ? 'Верно ✅' : 'Неверно ❌ Попробуйте другой вариант.'}
            </div>
            {/* Объяснение показываем после ответа (и при ошибке — как подсказку) */}
            {q.explanation && <div className="text-slate-300">{q.explanation}</div>}
          </div>
        )}
      </fieldset>
    </li>
  );
}

interface QuizViewProps {
  item: CourseItem;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
}

function QuizView({ item, isCompleted, onComplete, onNext }: QuizViewProps) {
  const questions = item.quizQuestions || [];
  // Выбранный вариант для каждого вопроса (индекс вопроса → индекс варианта)
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const correctCount = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  const allCorrect = questions.length > 0 && correctCount === questions.length;
  const passed = allCorrect || isCompleted;

  const handleSelect = (qIdx: number, optIdx: number) => {
    // Верно отвеченный вопрос блокируется; при ошибке можно выбрать другой вариант
    if (answers[qIdx] === questions[qIdx]?.correctIndex) return;
    const next = { ...answers, [qIdx]: optIdx };
    setAnswers(next);
    if (questions.length > 0 && questions.every((q, i) => next[i] === q.correctIndex)) {
      onComplete();
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-6">
      {item.content.trim() && (
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
          <MarkdownRenderer markdown={item.content} />
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4" /> Интерактивный тест
          </span>
          <span className="font-mono text-slate-400" aria-live="polite">
            Верно: {correctCount} / {questions.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${questions.length ? (correctCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {questions.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> В этом тесте пока нет вопросов.
        </div>
      )}

      <ol className="space-y-5">
        {questions.map((q, qIdx) => (
          <QuizQuestionCard
            key={qIdx}
            index={qIdx}
            question={q}
            selected={answers[qIdx]}
            onSelect={(optIdx) => handleSelect(qIdx, optIdx)}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {Object.keys(answers).length > 0 && !allCorrect && (
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Сбросить ответы
          </button>
        )}
        {passed && (
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>Тест пройден! Перейти далее</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

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

// --- РЕШЕНИЯ ДРУГИХ СТУДЕНТОВ (Community Solutions) ---

type PublishState = 'idle' | 'saving' | 'synced' | 'local';

const SOLUTION_SORTS: { id: SolutionSort; label: string }[] = [
  { id: 'popular', label: '🔥 Популярные' },
  { id: 'shortest', label: '⚡ Самые короткие' },
  { id: 'newest', label: '🕒 Новые' }
];

/** Цвет бейджа ранга — те же цвета, что и у рангов в профиле. */
function rankBadgeClass(rank: string): string {
  if (rank.startsWith('Senior')) return 'text-amber-400 border-amber-500/40 bg-amber-500/15';
  if (rank.startsWith('Middle')) return 'text-purple-400 border-purple-500/40 bg-purple-500/15';
  if (rank.startsWith('Junior')) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15';
  if (rank.startsWith('Стажёр')) return 'text-cyan-400 border-cyan-500/40 bg-cyan-500/15';
  return 'text-slate-300 border-slate-700 bg-slate-800';
}

interface CommunitySolutionsPanelProps {
  item: FlatCourseItem;
  isUnlocked: boolean;
  currentCode: string;
  /** Код, с которым пользователь в последний раз прошёл все тесты по этой задаче (null — не проходил в этой сессии) */
  verifiedCode: string | null;
  publishState: PublishState;
  /** Меняется после публикации — панель перезагружает ленту */
  refreshNonce: number;
  onPublish: () => void;
  onLoadCode: (code: string) => void;
}

// Монтируется с key={item.id}, поэтому состояние сбрасывается при смене задачи
function CommunitySolutionsPanel({
  item,
  isUnlocked,
  currentCode,
  verifiedCode,
  publishState,
  refreshNonce,
  onPublish,
  onLoadCode
}: CommunitySolutionsPanelProps) {
  const [cloud, setCloud] = useState<CommunitySolution[]>([]);
  const [local, setLocal] = useState<CommunitySolution[]>(() => getLocalSolutions(item.id));
  const [likedIds, setLikedIds] = useState<string[]>(() => readLikedIds());
  const [loading, setLoading] = useState<boolean>(true);
  const [now, setNow] = useState<number>(() => Date.now());
  const [sort, setSort] = useState<SolutionSort>('popular');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

  // Загрузка из Supabase только после решения задачи; при ошибке fetchCloudSolutions вернёт []
  useEffect(() => {
    if (!isUnlocked) return;
    let cancelled = false;
    const load = async () => {
      const cloudList = await fetchCloudSolutions(item.id);
      if (cancelled) return;
      setCloud(cloudList);
      setLocal(getLocalSolutions(item.id));
      setLikedIds(readLikedIds());
      setNow(Date.now());
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isUnlocked, item.id, refreshNonce]);

  const solutions = useMemo(
    () => sortSolutions(mergeSolutions(local, cloud), sort),
    [local, cloud, sort]
  );

  const handleLike = async (s: CommunitySolution) => {
    if (likingId) return;
    setLikingId(s.id);
    try {
      const { likes } = await toggleLike(s);
      setLikedIds(readLikedIds());
      const patch = (list: CommunitySolution[]) =>
        list.map((x) => (x.id === s.id ? { ...x, likes_count: likes } : x));
      setCloud(patch);
      setLocal(patch);
    } finally {
      setLikingId(null);
    }
  };

  const handleCopy = async (s: CommunitySolution) => {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(s.code);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId((cur) => (cur === s.id ? null : cur)), 2000);
    } catch {
      // Буфер обмена недоступен (нет разрешения или небезопасный контекст): молча пропускаем
    }
  };

  // Чужой код заменяет ваш: при непустом отличающемся коде просим нажать второй раз
  const handleLoad = (s: CommunitySolution) => {
    const needsConfirm = currentCode.trim() !== '' && !isSameCode(currentCode, s.code);
    if (needsConfirm && confirmLoadId !== s.id) {
      setConfirmLoadId(s.id);
      return;
    }
    setConfirmLoadId(null);
    onLoadCode(s.code);
  };

  if (!isUnlocked) {
    return (
      <section aria-labelledby="community-title" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <h3 id="community-title" className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          👥 Решения студентов
        </h3>
        <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-700 flex items-start gap-3 text-sm text-slate-300">
          <Lock className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
          <p>
            🔒 Решите эту задачу самостоятельно и пройдите все тесты, чтобы увидеть, как её решили другие студенты, и
            опубликовать свой вариант
          </p>
        </div>
      </section>
    );
  }

  const ownSolution = solutions.find((s) => s.is_own) ?? null;
  const codeIsVerified = !!verifiedCode && currentCode.trim() !== '' && isSameCode(currentCode, verifiedCode);
  const ownIsUpToDate = !!ownSolution && !ownSolution.pending_sync && isSameCode(ownSolution.code, currentCode);
  const publishDisabled = !codeIsVerified || ownIsUpToDate || publishState === 'saving';
  const publishHint =
    publishState === 'saving'
      ? 'Публикуем решение…'
      : publishState === 'local'
        ? 'Облако недоступно: решение сохранено на этом устройстве. Нажмите кнопку позже, чтобы повторить.'
        : ownIsUpToDate
          ? 'Ваше текущее решение уже в ленте.'
          : !codeIsVerified
            ? 'Чтобы опубликовать текущий код, сначала пройдите с ним все тесты.'
            : ownSolution
              ? 'Код изменился и прошёл тесты — можно обновить ваш пост.'
              : 'Поделитесь решением, чтобы другие студенты могли у вас поучиться.';

  return (
    <section aria-labelledby="community-title" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="community-title" className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          👥 Решения студентов ({solutions.length})
        </h3>
        {loading && (
          <span role="status" className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            Загружаем из облака…
          </span>
        )}
      </div>

      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-slate-400 flex-1 min-w-[180px]">
          {publishHint}
        </p>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishDisabled}
          className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {publishState === 'saving' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Опубликовать моё текущее решение в ленту
        </button>
      </div>

      <div role="group" aria-label="Сортировка решений" className="flex flex-wrap gap-2">
        {SOLUTION_SORTS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSort(opt.id)}
            aria-pressed={sort === opt.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${sort === opt.id
              ? 'bg-blue-600/25 border-blue-500/50 text-blue-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {solutions.length === 0 ? (
        <p className="text-xs text-slate-500">Пока никто не опубликовал решение. Станьте первым!</p>
      ) : (
        <ul className="space-y-4">
          {solutions.map((s) => {
            const isLiked = likedIds.includes(s.id);
            const time = formatRelativeTime(s.created_at, now);
            return (
              <li
                key={s.id}
                className={`rounded-xl border overflow-hidden ${s.is_own ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-800 bg-slate-950/60'}`}
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                  <span aria-hidden="true" className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full bg-slate-800 text-lg">
                    {s.author_avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate">{s.author_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rankBadgeClass(s.author_rank)}`}>
                        {s.author_rank}
                      </span>
                      {s.is_own && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">Ваше решение</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      <time dateTime={s.created_at}>{time}</time>
                      {s.pending_sync && <span> • ожидает синхронизации</span>}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 text-right leading-tight flex-shrink-0">
                    <div>
                      {s.lines_count} {pluralRu(s.lines_count, 'строка', 'строки', 'строк')}
                    </div>
                    <div>
                      {countChars(s.code)} {pluralRu(countChars(s.code), 'символ', 'символа', 'символов')}
                    </div>
                  </div>
                </div>
                <pre
                  tabIndex={0}
                  aria-label={`Код решения: ${s.author_name}`}
                  className="max-h-72 overflow-auto p-4 text-xs font-mono text-slate-100 leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <code>{s.code}</code>
                </pre>
                <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-800 bg-slate-900/50">
                  <button
                    type="button"
                    onClick={() => void handleLike(s)}
                    disabled={likingId === s.id}
                    aria-pressed={isLiked}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${isLiked
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                    👍 Полезное решение ({s.likes_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === s.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {copiedId === s.id ? 'Скопировано' : 'Скопировать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoad(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${confirmLoadId === s.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                  >
                    <FileCode className="w-3.5 h-3.5" aria-hidden="true" />
                    {confirmLoadId === s.id
                      ? 'Ваш код будет заменён — нажмите ещё раз'
                      : 'Загрузить в мой редактор для проверки'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// --- ЭКРАН БЛОКИРОВКИ ДЛЯ ГОСТЕЙ (AUTH GATE) ---

interface AuthGateCardProps {
  title: string;
  description: string;
  onLogin: () => void;
  onRegister: () => void;
  /** Компактная карточка внутри вкладки (true) или полноэкранный экран блокировки (false) */
  compact?: boolean;
}

function AuthGateCard({ title, description, onLogin, onRegister, compact = false }: AuthGateCardProps) {
  return (
    <section
      aria-labelledby="auth-gate-title"
      className={`relative overflow-hidden rounded-3xl border border-blue-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/50 text-center shadow-2xl ${compact ? 'p-6 sm:p-8' : 'p-8 sm:p-12'
        }`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative space-y-5 max-w-xl mx-auto">
        <span className="mx-auto grid place-items-center w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-400/30 shadow-[0_12px_32px_-12px_var(--color-blue-500)]">
          <Lock className="w-8 h-8 text-blue-300" aria-hidden="true" />
        </span>
        <h2 id="auth-gate-title" className={`${compact ? 'text-xl' : 'text-2xl sm:text-3xl'} font-extrabold text-white text-balance`}>
          {title}
        </h2>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{description}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onLogin}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>Войти в аккаунт</span>
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="px-6 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-slate-100 font-semibold text-sm border border-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-blue-300" aria-hidden="true" />
            <span>Создать аккаунт</span>
          </button>
        </div>
      </div>
    </section>
  );
}

const AUTH_GATE_DESCRIPTION =
  'Войдите в свой профиль или создайте бесплатный аккаунт за 30 секунд, чтобы поступить на курс, решать задачи в интерактивной IDE и копить баллы опыта (XP).';

// --- ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ ---

export default function App() {
  const [coursesList, setCoursesList] = useState<Course[]>(COURSES_DATA);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('cpp-basics');
  const [selectedItemId, setSelectedItemId] = useState<string>('cpp-1-theory');

  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  // Гость не зачислен ни на один курс: поступление доступно только после входа в аккаунт
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [userCodeMap, setUserCodeMap] = useState<Record<string, string>>({});
  const [studentName, setStudentName] = useState<string>('Кирилл Разработчик');

  // --- СОСТОЯНИЕ АККАУНТА И ЛИЧНОГО КАБИНЕТА ---
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('👨‍💻');
  const [userBio, setUserBio] = useState<string>('Изучаю C++ и Python на платформе DevCourses');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  // По умолчанию при выходе стираем прогресс с устройства (безопасно для общих компьютеров)
  const [clearLocalOnLogout, setClearLocalOnLogout] = useState<boolean>(true);
  // Смена пароля в личном кабинете
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authName, setAuthName] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  // Экран «Проверьте почту» после регистрации (письмо отправляется через EmailJS)
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [pendingConfirmationName, setPendingConfirmationName] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Обратный отсчёт до разрешения повторной отправки письма
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((sec) => Math.max(0, sec - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    'cpp-mod-1': true,
    'cpp-mod-2': true,
    'py-mod-1': true,
    'py-mod-2': true
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const activeItemRef = useRef<string>('cpp-1-theory');

  // --- РЕШЕНИЯ СТУДЕНТОВ ---
  // Код, с которым задача в последний раз прошла все тесты (только в этой сессии): публиковать можно только его
  const [verifiedCodeMap, setVerifiedCodeMap] = useState<Record<string, string>>({});
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [solutionsNonce, setSolutionsNonce] = useState<number>(0);

  // Счётчик повторных попыток синхронизации (растёт при возврате сети и обновлении токена)
  const [syncNonce, setSyncNonce] = useState<number>(0);

  // Слушатель событий Supabase Auth. Внутри колбэка нельзя await-ить вызовы Supabase (deadlock),
  // поэтому здесь только обновление состояния.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Роль администратора (только для показа ссылки; реальная защита — RLS в Supabase)
      setIsAdminUser(session?.user?.app_metadata?.role === 'admin');

      if (event === 'PASSWORD_RECOVERY') {
        // Пользователь пришёл по ссылке из письма «сбросить пароль»
        setActiveTab('profile');
        setAuthMode('reset-password');
        setAuthPassword('');
        setAuthPasswordConfirm('');
        setAuthError(null);
      } else if (event === 'SIGNED_OUT') {
        // Выход в этой или другой вкладке, либо истёкшая сессия: у гостя нет прогресса
        setCurrentUser(null);
        setSyncStatus('idle');
        setEnrolledCourses([]);
        setCompletedItems([]);
        setUserCodeMap({});
      } else if (event === 'TOKEN_REFRESHED') {
        // Свежий токен — повторяем отложенную синхронизацию, если она была
        setSyncNonce((n) => n + 1);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Возврат сети — повторяем синхронизацию из офлайн-очереди
  useEffect(() => {
    const onOnline = () => setSyncNonce((n) => n + 1);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
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

        // Прогресс (курсы, шаги, код) из localStorage в стейт гостя не попадает:
        // он применяется только вместе с облачным профилем после проверки сессии ниже
        if (savedCustomCourses && isMounted) setCoursesList(savedCustomCourses as Course[]);
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

          const cloud = toAccount(accData);
          if (cloud && isMounted) {
            let account: UserAccount = cloud;
            // Есть изменения, не дошедшие до облака (вкладку закрыли офлайн) — не теряем их
            if (safeGet(PENDING_SYNC_KEY)) {
              const local: LocalProfile = createGuestProfile(
                savedName ?? cloud.display_name,
                savedEnrolled ?? cloud.enrolled_courses,
                savedCompleted ?? [],
                savedCode ?? {},
                savedAvatar ?? cloud.avatar,
                savedBio ?? cloud.bio
              );
              const merged = mergeGuestToCloud(local, cloud);
              // Локальные правки новее облачных: текст и код берём из них
              account = {
                ...merged,
                display_name: local.display_name,
                avatar: local.avatar,
                bio: local.bio,
                user_code_map: { ...cloud.user_code_map, ...local.user_code_map }
              };
            }
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

  // Локальное сохранение (с задержкой, чтобы не писать весь код в localStorage на каждый символ).
  // Только для авторизованного пользователя: гостевой прогресс не сохраняется.
  useEffect(() => {
    if (!isHydrated || !currentUser) return;
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
  }, [enrolledCourses, completedItems, userCodeMap, studentName, userAvatar, userBio, currentUser, isHydrated]);

  // Фоновая синхронизация с облаком + офлайн-очередь.
  // Флаг PENDING_SYNC_KEY ставится до отправки и снимается только после успешного ответа,
  // поэтому изменения, сделанные без сети, дойдут до облака при следующей возможности.
  useEffect(() => {
    if (!isHydrated || !currentUser) return;
    safeSet(PENDING_SYNC_KEY, '1');
    const timer = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline-pending');
        return;
      }
      setSyncStatus('syncing');
      try {
        const { error } = await supabase
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

        if (error) {
          setSyncStatus(isNetworkError(error.message) ? 'offline-pending' : 'error');
          return;
        }
        safeRemove(PENDING_SYNC_KEY);
        setSyncStatus('synced');
      } catch (err) {
        // fetch бросает TypeError при отсутствии сети
        setSyncStatus(isNetworkError(err instanceof Error ? err.message : String(err)) ? 'offline-pending' : 'error');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [enrolledCourses, completedItems, userCodeMap, studentName, userAvatar, userBio, currentUser, isHydrated, syncNonce]);

  // --- ФУНКЦИИ РЕГИСТРАЦИИ И ВХОДА В АККАУНТ ---

  const showSync = (message: string, ms = 4000) => {
    setSyncMessage(message);
    setTimeout(() => setSyncMessage(null), ms);
  };

  const applyAccount = (acc: UserAccount) => {
    setCurrentUser(acc);
    setStudentName(acc.display_name);
    setUserAvatar(acc.avatar);
    setUserBio(acc.bio);
    setEnrolledCourses(acc.enrolled_courses);
    setCompletedItems(acc.completed_items);
    setUserCodeMap(acc.user_code_map);
  };

  /**
   * После входа: загружаем облачный профиль и сливаем с гостевым прогрессом.
   * Возвращает число шагов, добавленных в облако из гостевого режима.
   * Изменённый аккаунт уйдёт в облако через эффект фоновой синхронизации.
   */
  const syncAfterSignIn = async (email: string, fallbackName: string): Promise<number> => {
    const local = createGuestProfile(studentName, enrolledCourses, completedItems, userCodeMap, userAvatar, userBio);
    const { data: row, error } = await supabase.from('user_accounts').select('*').eq('email', email).maybeSingle();
    if (error) throw new Error(error.message);

    const cloud = toAccount(row);
    if (cloud) {
      const merged = mergeGuestToCloud(local, cloud);
      applyAccount(merged);
      return merged.completed_items.length - cloud.completed_items.length;
    }

    // Первый вход после подтверждения почты — создаём профиль из локального прогресса
    const fresh: UserAccount = { ...local, email, display_name: fallbackName };
    const { error: insertError } = await supabase.from('user_accounts').insert([fresh]);
    if (insertError) throw new Error(insertError.message);
    applyAccount(fresh);
    return 0;
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setShowPassword(false);
  };

  /** Отправляет письмо подтверждения через EmailJS. Возвращает true при успехе. */
  const sendConfirmationEmail = async (email: string, name: string): Promise<boolean> => {
    setEmailSending(true);
    setEmailError(null);
    try {
      await sendEmailViaEmailJS({
        user_email: email,
        user_name: name,
        link: window.location.origin
      });
      setResendCooldown(RESEND_COOLDOWN_SEC);
      return true;
    } catch (err) {
      console.error('EmailJS send failed:', err);
      setEmailError(err instanceof Error ? err.message : translateEmailError(err));
      return false;
    } finally {
      setEmailSending(false);
    }
  };

  /** Кнопка «Отправить письмо повторно» на экране ожидания */
  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail || resendCooldown > 0 || emailSending) return;
    const ok = await sendConfirmationEmail(pendingConfirmationEmail, pendingConfirmationName);
    if (ok) showSync('Письмо отправлено повторно. Проверьте папки «Входящие» и «Спам» 📬', 6000);
  };

  /** Кнопка «Я уже подтвердил почту — Перейти ко входу» */
  const handleConfirmationDone = () => {
    if (!currentUser && pendingConfirmationEmail) setAuthEmail(pendingConfirmationEmail);
    setPendingConfirmationEmail(null);
    setPendingConfirmationName('');
    setEmailError(null);
    switchAuthMode('login');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanName = authName.trim() || DEFAULT_NAME;

    // --- Сброс пароля: шаг 2 (пришли по ссылке из письма, сессия восстановления уже есть) ---
    if (authMode === 'reset-password') {
      const validation = validateNewPassword(authPassword, authPasswordConfirm);
      if (validation) {
        setAuthError(validation);
        return;
      }
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.updateUser({ password: authPassword });
        if (error) {
          setAuthError(translateAuthError(error.message));
          return;
        }
        const email = data.user?.email?.toLowerCase();
        if (email) await syncAfterSignIn(email, cleanName);
        switchAuthMode('login');
        showSync('Пароль обновлён. Вы вошли в аккаунт 🔐');
      } catch (err) {
        setAuthError(translateAuthError(err instanceof Error ? err.message : null));
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setAuthError('Введите корректный Email.');
      return;
    }

    // --- Сброс пароля: шаг 1 (отправляем письмо со ссылкой) ---
    if (authMode === 'forgot-password') {
      setAuthLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin
        });
        // Не раскрываем, существует ли аккаунт: сообщение одинаковое; показываем только сетевые и лимитные ошибки
        if (error && (isNetworkError(error.message) || /rate limit|security purposes/i.test(error.message))) {
          setAuthError(translateAuthError(error.message));
          return;
        }
        switchAuthMode('login');
        showSync('Если аккаунт с таким Email существует, мы отправили ссылку для сброса пароля 📬', 8000);
      } catch (err) {
        setAuthError(translateAuthError(err instanceof Error ? err.message : null));
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!authPassword) {
      setAuthError('Пожалуйста, введите пароль.');
      return;
    }
    if (authMode === 'register') {
      const validation = validateNewPassword(authPassword, authPasswordConfirm);
      if (validation) {
        setAuthError(validation);
        return;
      }
    }

    setAuthLoading(true);
    try {
      const localProfile: UserAccount = {
        ...createGuestProfile(cleanName, enrolledCourses, completedItems, userCodeMap, userAvatar, userBio),
        email: cleanEmail
      };

      if (authMode === 'register') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: authPassword,
          options: { data: { display_name: cleanName } }
        });

        if (signUpError) {
          setAuthError(translateAuthError(signUpError.message));
          return;
        }

        // Ожидается, что «Confirm email» в Supabase выключен — тогда signUp сразу возвращает сессию.
        let session = signUpData.session;
        if (!session) {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: authPassword
          });
          session = signInData.session;
        }

        if (session) {
          // upsert: повторная регистрация/двойной клик не падают на уникальном email
          const { error: upsertError } = await supabase
            .from('user_accounts')
            .upsert([localProfile], { onConflict: 'email' });
          if (upsertError) {
            setAuthError(translateAuthError(upsertError.message));
            return;
          }
          applyAccount(localProfile);
        }

        // Письмо уходит через EmailJS; его ошибка не отменяет созданный аккаунт
        const sent = await sendConfirmationEmail(cleanEmail, cleanName);
        setPendingConfirmationEmail(cleanEmail);
        setPendingConfirmationName(cleanName);
        setAuthPassword('');
        setAuthPasswordConfirm('');
        setShowPassword(false);
        setAuthName('');

        if (!session) {
          // Supabase всё ещё требует подтверждения — вход станет доступен после отключения «Confirm email»
          setAuthError('Аккаунт создан, но сервер требует подтверждения Email перед входом.');
        } else if (sent) {
          showSync(`Письмо с подтверждением отправлено на ${cleanEmail}! Аккаунт создан 🎉`, 6000);
        } else {
          showSync('Аккаунт создан, но письмо отправить не удалось. Попробуйте повторить отправку.', 6000);
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authPassword
        });

        if (signInError || !signInData.session) {
          setAuthError(translateAuthError(signInError?.message));
          return;
        }

        const delta = await syncAfterSignIn(cleanEmail, cleanName);
        if (delta > 0) {
          showSync(`Вы успешно вошли! Слили ${delta} шагов из гостевого режима в облако ☁️`);
        } else {
          showSync('Вы успешно вошли! Весь ваш прогресс загружен из облака ☁️');
        }
      }
      setAuthPassword('');
      setAuthPasswordConfirm('');
    } catch (err) {
      setAuthError(translateAuthError(err instanceof Error ? err.message : null));
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
    setCurrentUser(null);
    setSyncStatus('idle');
    // Гость не имеет прогресса: сбрасываем стейт всегда (в localStorage он остаётся, если не выбрана очистка)
    setEnrolledCourses([]);
    setCompletedItems([]);
    setUserCodeMap({});
    if (clearLocalOnLogout) {
      // Очищаем личные данные с этого устройства (для общих компьютеров)
      LOCAL_DATA_KEYS.forEach((key) => safeRemove(key));
      setStudentName(DEFAULT_NAME);
      setUserAvatar(DEFAULT_AVATAR);
      setUserBio('');
      showSync('Вы вышли из аккаунта. Все локальные данные удалены с устройства.', 3000);
    } else {
      showSync('Вы вышли из аккаунта. Локальный прогресс остался на устройстве.', 3000);
    }
  };

  const handleManualProfileSave = async () => {
    if (!currentUser) {
      showSync('Профиль сохранён локально в браузере ✅', 3000);
      return;
    }

    setAuthLoading(true);
    setSyncStatus('syncing');
    try {
      const { error } = await supabase
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

      if (error) {
        setSyncStatus(isNetworkError(error.message) ? 'offline-pending' : 'error');
        showSync(`Не удалось сохранить: ${translateAuthError(error.message)}`, 5000);
        return;
      }
      safeRemove(PENDING_SYNC_KEY);
      setSyncStatus('synced');
      showSync('Профиль и прогресс сохранены в облаке ☁️✅', 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      setSyncStatus(isNetworkError(message) ? 'offline-pending' : 'error');
      showSync('Нет связи. Изменения сохранены локально и отправятся при появлении сети.', 5000);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- БЕЗОПАСНОСТЬ И ДАННЫЕ ---

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    const validation = validateNewPassword(newPassword, newPasswordConfirm);
    if (validation) {
      setSecurityError(validation);
      return;
    }
    setSecurityLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setSecurityError(translateAuthError(error.message));
        return;
      }
      setNewPassword('');
      setNewPasswordConfirm('');
      showSync('Пароль успешно изменён 🔐');
    } catch (err) {
      setSecurityError(translateAuthError(err instanceof Error ? err.message : null));
    } finally {
      setSecurityLoading(false);
    }
  };

  /** Скачать весь прогресс одним JSON-файлом (резервная копия). */
  const handleExportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      email: currentUser?.email ?? null,
      ...createGuestProfile(studentName, enrolledCourses, completedItems, userCodeMap, userAvatar, userBio)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devcourses-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /** Полный сброс прогресса (двухшаговое подтверждение). В облако уйдёт через фоновую синхронизацию. */
  const handleResetProgress = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setEnrolledCourses([...DEFAULT_COURSES]);
    setCompletedItems([]);
    setUserCodeMap({});
    showSync('Прогресс сброшен. Можно начинать заново 🌱', 4000);
  };

  // --- РАСЧЁТ РАНГА И XP ---

  // Гость не накапливает XP и бонусы
  const totalXp = currentUser ? completedItems.length * 50 : 0;
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
    setPublishState('idle');
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

  /** Переход к форме входа / регистрации (Auth Gate) */
  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError(null);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnrollAndOpen = (courseId: string) => {
    if (!currentUser) {
      setActiveTab('profile');
      showSync('🔒 Пожалуйста, войдите в аккаунт или зарегистрируйтесь, чтобы поступить на курс и решать задачи', 6000);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
    if (!currentUser) {
      setActiveTab('profile');
      return;
    }
    setCompletedItems((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  };

  const goToNextItem = () => {
    if (!currentUser) {
      setActiveTab('profile');
      return;
    }
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

  const currentCode =
    userCodeMap[currentItem?.id] !== undefined ? userCodeMap[currentItem.id] : currentItem?.initialCode || '';

  const handleCodeChange = (newCode: string) => {
    setUserCodeMap((prev) => ({
      ...prev,
      [currentItem.id]: newCode
    }));
  };

  /**
   * Публикует код в ленту решений (localStorage + Supabase). Ошибки сети/таблицы обрабатываются
   * внутри publishSolution: в худшем случае решение остаётся только локально.
   */
  const publishCommunitySolution = async (taskId: string, code: string) => {
    if (!code.trim()) return;
    // Тот же код уже в облаке — дубликат не создаём и запрос не шлём
    if (isOwnSynced(getOwnSolution(taskId), code)) return;
    const isActive = () => activeItemRef.current === taskId;
    if (isActive()) setPublishState('saving');
    const { syncedToCloud } = await publishSolution({
      taskId,
      courseId: currentCourse.id,
      language: currentCourse.language,
      authorName: studentName,
      authorAvatar: userAvatar,
      authorRank: userRank.title,
      code
    });
    if (isActive()) {
      setPublishState(syncedToCloud ? 'synced' : 'local');
      setSolutionsNonce((n) => n + 1);
    }
  };

  const handleRunTaskTests = async () => {
    if (!currentUser) {
      setActiveTab('profile');
      return;
    }
    if (!currentItem || currentItem.type !== 'task' || isRunningTests) return;
    const runItemId = currentItem.id;
    // Фиксируем код на момент запуска: пока идут тесты, пользователь может продолжать печатать
    const runCode = currentCode;
    setIsRunningTests(true);
    setTestResults(null);

    let passedAll = false;
    try {
      const results = await runTests(
        currentCourse.langKey,
        runCode,
        currentItem.tests || [],
        runItemId,
        currentItem.solution
      );

      passedAll = results.length > 0 && results.every((r: TestResult) => r.passed);
      if (passedAll) {
        markItemCompleted(runItemId);
        setVerifiedCodeMap((prev) => ({ ...prev, [runItemId]: runCode }));
      }
      // Не показываем результаты, если пользователь уже перешёл на другой урок
      if (activeItemRef.current === runItemId) setTestResults(results);
    } finally {
      setIsRunningTests(false);
    }
    // Автопубликация после успешного прохождения всех тестов (не блокирует кнопку запуска)
    if (passedAll) void publishCommunitySolution(runItemId, runCode);
  };

  const handleManualPublish = () => {
    const verified = verifiedCodeMap[currentItem.id];
    if (!verified || !isSameCode(verified, currentCode)) return;
    void publishCommunitySolution(currentItem.id, currentCode);
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
  const passwordStrength = authPassword ? getPasswordStrength(authPassword) : 'weak';

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
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${activeTab === nav.id
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
            {!currentUser ? (
              <button
                type="button"
                onClick={() => openAuth('login')}
                title="XP начисляются только авторизованным студентам"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span className="tabular-nums">0 XP</span>
                <span className="text-slate-500">•</span>
                <span className="text-blue-300">Войти</span>
              </button>
            ) : (
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
            )}

            {/* Индикатор синхронизации с облаком */}
            {currentUser && syncStatus !== 'idle' && (
              <div
                role="status"
                aria-live="polite"
                title={
                  syncStatus === 'offline-pending'
                    ? 'Изменения сохранены на устройстве и отправятся при появлении сети'
                    : syncStatus === 'error'
                      ? 'Не удалось сохранить в облако'
                      : undefined
                }
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs"
              >
                {syncStatus === 'syncing' && (
                  <>
                    <CloudUpload className="w-3.5 h-3.5 text-blue-400 animate-pulse" aria-hidden="true" />
                    <span className="text-slate-400">Сохранение…</span>
                  </>
                )}
                {syncStatus === 'synced' && (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="text-slate-300">В облаке</span>
                  </>
                )}
                {syncStatus === 'offline-pending' && (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span className="text-slate-300">Офлайн</span>
                  </>
                )}
                {syncStatus === 'error' && (
                  <button
                    type="button"
                    onClick={() => setSyncNonce((n) => n + 1)}
                    className="flex items-center gap-1.5 text-rose-300 hover:text-rose-200 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Повторить</span>
                  </button>
                )}
              </div>
            )}


            <button
              onClick={() => setActiveTab('profile')}
              className={`pl-1.5 pr-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer ${currentUser
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

      <main id="main" className={`flex-1 flex flex-col ${activeTab !== 'learn' || !currentUser ? 'pb-24 lg:pb-0' : ''}`}>
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
                {/* Форма показывается и залогиненному, если он пришёл по ссылке сброса пароля */}
                {pendingConfirmationEmail ? (
                  <section
                    aria-labelledby="pending-email-title"
                    className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <h2 id="pending-email-title" className="text-2xl font-bold text-white">
                        Проверьте вашу почту 📬
                      </h2>
                      <Mail className="w-8 h-8 text-blue-400" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-slate-300">
                      Письмо с подтверждением отправлено на{' '}
                      <span className="font-semibold text-white break-all">{pendingConfirmationEmail}</span>!
                    </p>
                    <p className="text-sm text-slate-400">
                      Мы отправили вам письмо для активации аккаунта. Перейдите по ссылке или нажмите кнопку ниже.
                      Если письма нет, проверьте папку «Спам».
                    </p>

                    {(emailError || authError) && (
                      <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-1">
                        {authError && <p>{authError}</p>}
                        {emailError && <p>{emailError}</p>}
                      </div>
                    )}

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resendCooldown > 0 || emailSending}
                        aria-live="polite"
                        className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-4 h-4 ${emailSending ? 'animate-spin' : ''}`} aria-hidden="true" />
                        {emailSending
                          ? 'Отправляем…'
                          : resendCooldown > 0
                            ? `Отправить письмо повторно (через ${resendCooldown} с)`
                            : 'Отправить письмо повторно'}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmationDone}
                        className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        {currentUser ? 'Я уже подтвердил почту — Перейти в кабинет' : 'Я уже подтвердил почту — Перейти ко входу'}
                      </button>
                    </div>
                  </section>
                ) : !currentUser || authMode === 'reset-password' ? (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          Облачный аккаунт
                        </span>
                        <h2 className="text-2xl font-bold text-white mt-1">
                          {authMode === 'login'
                            ? 'Вход в личный кабинет'
                            : authMode === 'register'
                              ? 'Регистрация ученика'
                              : authMode === 'forgot-password'
                                ? 'Восстановление пароля'
                                : 'Новый пароль'}
                        </h2>
                      </div>
                      {authMode === 'forgot-password' ? (
                        <Mail className="w-8 h-8 text-blue-400" aria-hidden="true" />
                      ) : authMode === 'reset-password' ? (
                        <KeyRound className="w-8 h-8 text-blue-400" aria-hidden="true" />
                      ) : (
                        <User className="w-8 h-8 text-blue-400" aria-hidden="true" />
                      )}
                    </div>

                    {(authMode === 'login' || authMode === 'register') && (
                    <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => switchAuthMode('login')}
                        className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${authMode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        <LogIn className="w-3.5 h-3.5" /> Вход
                      </button>
                      <button
                        type="button"
                        onClick={() => switchAuthMode('register')}
                        className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${authMode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Регистрация
                      </button>
                    </div>
                    )}

                    {authMode === 'forgot-password' && (
                      <p className="text-xs text-slate-400">
                        Укажите Email аккаунта — мы пришлём ссылку для установки нового пароля.
                      </p>
                    )}

                    {authError && (
                      <div role="alert" className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                      {authMode === 'register' && (
                        <div className="space-y-1.5">
                          <label htmlFor="authName" className="text-xs font-semibold text-slate-400">
                            Ваше Имя и Фамилия (для сертификатов)
                          </label>
                          <input
                            id="authName"
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

                      {authMode !== 'reset-password' && (
                        <>
                          <div className="space-y-1.5">
                            <label htmlFor="authEmail" className="text-xs font-semibold text-slate-400">
                              Email адрес
                            </label>
                            <input
                              id="authEmail"
                              type="email"
                              required
                              value={authEmail}
                              maxLength={254}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              placeholder="student@example.com"
                              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          {authMode === 'login' && (
                            <button
                              type="button"
                              onClick={() => switchAuthMode('forgot-password')}
                              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
                            >
                              ← Забыли пароль?
                            </button>
                          )}
                        </>
                      )}

                      {(authMode === 'login' || authMode === 'register') && (
                        <div className="space-y-1.5">
                          <label htmlFor="authPassword" className="text-xs font-semibold text-slate-400">
                            {authMode === 'register' ? 'Придумайте пароль' : 'Пароль'}
                          </label>
                          <div className="relative">
                            <input
                              id="authPassword"
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 cursor-pointer"
                              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {authMode === 'register' && authPassword && (
                            <div className="flex items-center gap-2 pt-1" aria-live="polite">
                              <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    passwordStrength === 'weak'
                                      ? 'w-1/3 bg-rose-500'
                                      : passwordStrength === 'medium'
                                        ? 'w-2/3 bg-amber-500'
                                        : 'w-full bg-emerald-500'
                                  }`}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {passwordStrength === 'weak' ? 'Слабый' : passwordStrength === 'medium' ? 'Средний' : 'Надёжный'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {authMode === 'reset-password' && (
                        <div className="space-y-1.5">
                          <label htmlFor="authNewPassword" className="text-xs font-semibold text-slate-400">
                            Новый пароль (минимум {MIN_PASSWORD_LENGTH} символов)
                          </label>
                          <input
                            id="authNewPassword"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={authPassword}
                            autoComplete="new-password"
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                          />
                          {authPassword && (
                            <span className="block text-[10px] font-semibold text-slate-400" aria-live="polite">
                              Надёжность: {passwordStrength === 'weak' ? 'слабый' : passwordStrength === 'medium' ? 'средний' : 'надёжный'}
                            </span>
                          )}
                        </div>
                      )}

                      {(authMode === 'register' || authMode === 'reset-password') && (
                        <div className="space-y-1.5">
                          <label htmlFor="authPasswordConfirm" className="text-xs font-semibold text-slate-400">
                            Подтвердите пароль
                          </label>
                          <input
                            id="authPasswordConfirm"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={authPasswordConfirm}
                            onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                            placeholder="••••••••"
                            className={`w-full px-4 py-3 rounded-xl bg-slate-950 border text-sm text-white focus:outline-none transition-colors ${
                              authPasswordConfirm && authPassword !== authPasswordConfirm
                                ? 'border-rose-600 focus:border-rose-500'
                                : 'border-slate-800 focus:border-blue-500'
                            }`}
                          />
                          {authPasswordConfirm && authPassword !== authPasswordConfirm && (
                            <span className="text-xs text-rose-400">Пароли не совпадают</span>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/25 cursor-pointer transition-all"
                      >
                        {authLoading
                          ? 'Обработка...'
                          : authMode === 'login'
                            ? 'Войти и загрузить прогресс'
                            : authMode === 'register'
                              ? 'Создать аккаунт и сохранить прогресс'
                              : authMode === 'forgot-password'
                                ? 'Отправить ссылку на Email'
                                : 'Установить новый пароль'}
                      </button>

                      {(authMode === 'forgot-password' || authMode === 'reset-password') && (
                        <button
                          type="button"
                          onClick={() => switchAuthMode('login')}
                          className="w-full text-xs text-slate-400 hover:text-white cursor-pointer transition-colors"
                        >
                          ← Вернуться ко входу
                        </button>
                      )}

                    </form>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                        <Cloud className="w-4 h-4" /> Облако подключено
                      </span>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Выйти
                      </button>
                    </div>
                    <label className="flex items-center justify-end gap-2 -mt-3 text-[11px] text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={clearLocalOnLogout}
                        onChange={(e) => setClearLocalOnLogout(e.target.checked)}
                        className="accent-rose-500"
                      />
                      При выходе удалить данные с этого устройства
                    </label>

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
                            className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer ${userAvatar === emo
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

                    {/* Безопасность и данные */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" /> Безопасность и данные
                      </h3>

                      <form onSubmit={handleChangePassword} className="space-y-2">
                        <label htmlFor="newPassword" className="block text-xs font-semibold text-slate-400">
                          Сменить пароль
                        </label>
                        <input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          autoComplete="new-password"
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={`Новый пароль (от ${MIN_PASSWORD_LENGTH} символов)`}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                        <input
                          type="password"
                          aria-label="Повторите новый пароль"
                          value={newPasswordConfirm}
                          autoComplete="new-password"
                          onChange={(e) => setNewPasswordConfirm(e.target.value)}
                          placeholder="Повторите новый пароль"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                        />
                        {securityError && (
                          <p role="alert" className="text-xs text-rose-400">{securityError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={securityLoading || !newPassword}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <KeyRound className="w-4 h-4" aria-hidden="true" />
                          {securityLoading ? 'Сохранение...' : 'Обновить пароль'}
                        </button>
                      </form>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleExportData}
                          className="py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" /> Экспорт JSON
                        </button>
                        <button
                          type="button"
                          onClick={handleResetProgress}
                          onBlur={() => setConfirmReset(false)}
                          className={`py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${confirmReset
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-rose-950/40 border-rose-800/50 text-rose-300 hover:bg-rose-900/50'
                            }`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                          {confirmReset ? 'Точно сбросить?' : 'Сбросить прогресс'}
                        </button>
                      </div>
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
                      const isEligible = prog.percent >= 80;
                      const isGold = prog.percent >= 100;

                      return (
                        <div
                          key={course.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${course.badgeBg}`}>
                                {course.language}
                              </span>
                              <span className="text-sm font-bold text-white">{course.title}</span>
                            </div>
                            <CourseMilestoneProgressBar
                              percent={prog.percent}
                              accent={course.accent}
                            />
                            <div className="text-[11px] text-slate-400 font-mono">
                              Уроков завершено: {prog.completed} из {prog.total}
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
                              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border ${
                                isGold
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                                  : isEligible
                                  ? 'bg-slate-300/15 hover:bg-slate-300/25 text-slate-200 border-slate-300/30'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                              }`}
                              title={!isEligible ? 'Пройдите минимум 80% курса для получения сертификата' : undefined}
                            >
                              {isGold ? (
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                              ) : isEligible ? (
                                <Medal className="w-3.5 h-3.5 text-slate-300" />
                              ) : (
                                <Award className="w-3.5 h-3.5 text-slate-500" />
                              )}
                              <span>
                                {isGold
                                  ? 'Диплом (100%)'
                                  : isEligible
                                  ? 'Сертификат (80%+)'
                                  : 'Сертификат'}
                              </span>
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
                          {currentUser ? (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>Начать обучение</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" aria-hidden="true" />
                              <span>🔒 Войти, чтобы поступить на курс</span>
                            </>
                          )}
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

              {!currentUser && (activeTab === 'my-learning' || activeTab === 'certificates') && (
                <AuthGateCard
                  compact
                  title={
                    activeTab === 'my-learning'
                      ? 'Войдите, чтобы записываться на курсы и решать задачи'
                      : 'Войдите, чтобы получать сертификаты'
                  }
                  description={
                    activeTab === 'my-learning'
                      ? 'Моё обучение доступно только авторизованным студентам. ' + AUTH_GATE_DESCRIPTION
                      : 'Сертификаты и дипломы выдаются только авторизованным студентам. ' + AUTH_GATE_DESCRIPTION
                  }
                  onLogin={() => openAuth('login')}
                  onRegister={() => openAuth('register')}
                />
              )}

              {currentUser && (activeTab === 'dashboard' || activeTab === 'my-learning') && (
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
                              <CourseMilestoneProgressBar
                                percent={prog.percent}
                                accent={course.accent}
                              />
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
                                className={`py-2.5 px-4 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${
                                  prog.percent >= 100
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                                    : prog.percent >= 80
                                    ? 'bg-slate-300/15 text-slate-200 border-slate-300/30 hover:bg-slate-300/25'
                                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                                }`}
                                title={prog.percent < 80 ? 'Пройдите минимум 80% курса для получения сертификата' : undefined}
                              >
                                {prog.percent >= 100 ? (
                                  <Crown className="w-4 h-4 text-amber-400" />
                                ) : prog.percent >= 80 ? (
                                  <Medal className="w-4 h-4 text-slate-300" />
                                ) : (
                                  <Award className="w-4 h-4 text-slate-500" />
                                )}
                                <span>
                                  {prog.percent >= 100
                                    ? 'Диплом (100%)'
                                    : prog.percent >= 80
                                    ? 'Сертификат (80%+)'
                                    : 'Сертификат'}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {currentUser && activeTab === 'certificates' && (
                <section className="space-y-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Award className="w-6 h-6 text-amber-400" />
                    <span>Ваши сертификаты</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {coursesList.map((course) => {
                      const prog = getCourseProgress(course);
                      const isGold = prog.percent >= 100;
                      const isSilver = prog.percent >= 80 && prog.percent < 100;

                      return (
                        <div key={course.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-5 shadow-xl">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${course.badgeBg}`}>
                                {course.language}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                {prog.completed} / {prog.total} уроков ({prog.percent}%)
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white">{course.title}</h3>

                            <CourseMilestoneProgressBar
                              percent={prog.percent}
                              accent={course.accent}
                            />

                            {/* Статус рубежа */}
                            <div className="pt-1">
                              {isGold ? (
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 font-semibold">
                                    <Crown className="w-4 h-4 text-amber-400" /> Доступен «Диплом с отличием»
                                  </span>
                                  <span className="font-mono text-emerald-400 text-[11px] font-bold">100% PASS</span>
                                </div>
                              ) : isSilver ? (
                                <div className="p-3 rounded-xl bg-slate-300/10 border border-slate-300/30 text-xs text-slate-200 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 font-semibold">
                                    <Medal className="w-4 h-4 text-slate-300" /> Доступен «Сертификат хорошиста»
                                  </span>
                                  <span className="font-mono text-amber-400 text-[11px]">До диплома: {100 - prog.percent}%</span>
                                </div>
                              ) : (
                                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Доступен от 80% курса
                                  </span>
                                  <span className="font-mono text-slate-500 text-[11px]">Осталось: {80 - prog.percent}%</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedCourseId(course.id);
                              setActiveTab('certificate');
                            }}
                            className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              isGold
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20'
                                : isSilver
                                ? 'bg-gradient-to-r from-slate-200 to-slate-400 hover:from-white hover:to-slate-300 text-slate-950 shadow-lg shadow-slate-300/20'
                                : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700/80'
                            }`}
                          >
                            {isGold ? (
                              <>
                                <Crown className="w-4 h-4 text-amber-950" />
                                <span>Открыть «Диплом с отличием»</span>
                              </>
                            ) : isSilver ? (
                              <>
                                <Medal className="w-4 h-4 text-slate-950" />
                                <span>Открыть «Сертификат хорошиста»</span>
                              </>
                            ) : (
                              <>
                                <Award className="w-4 h-4 text-slate-500" />
                                <span>Открыть предпросмотр (нужно 80%)</span>
                              </>
                            )}
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${langFilter === lang
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

                            {isEnrolled && (
                              <div className="pt-2">
                                <CourseMilestoneProgressBar
                                  percent={getCourseProgress(course).percent}
                                  accent={course.accent}
                                  compact={true}
                                />
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleEnrollAndOpen(course.id)}
                            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            {currentUser ? (
                              <>
                                <span>{isEnrolled ? 'Открыть курс (Вы зачислены)' : 'Поступить на курс (Бесплатно)'}</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            ) : (
                              <>
                                <Lock className="w-4 h-4" aria-hidden="true" />
                                <span>🔒 Войти, чтобы поступить на курс</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

        {/* AUTH GATE: гость не может открывать уроки, задачи, квизы и сертификаты */}
        {!currentUser && (activeTab === 'learn' || activeTab === 'certificate') && (
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
            <div className="max-w-2xl w-full">
              <AuthGateCard
                title="Доступно только авторизованным студентам"
                description={AUTH_GATE_DESCRIPTION}
                onLogin={() => openAuth('login')}
                onRegister={() => openAuth('register')}
              />
            </div>
          </div>
        )}

        {/* ИНТЕРФЕЙС ПРОХОЖДЕНИЯ УРОКОВ И ЗАДАЧ */}
        {currentUser && activeTab === 'learn' && currentItem && (
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
              className={`${mobileSidebarOpen ? 'block' : 'hidden'
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

                {/* Шкала прогресса текущего курса в боковом меню */}
                {(() => {
                  const sideProg = getCourseProgress(currentCourse);
                  return (
                    <div className="pt-1 space-y-1.5">
                      <CourseMilestoneProgressBar
                        percent={sideProg.percent}
                        accent={currentCourse.accent}
                        compact={true}
                      />
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          {sideProg.completed}/{sideProg.total} уроков
                        </span>
                        {sideProg.percent >= 80 ? (
                          <button
                            onClick={() => setActiveTab('certificate')}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              sideProg.percent >= 100
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                : 'bg-slate-300/20 text-slate-200 border border-slate-300/30 hover:bg-slate-300/30'
                            }`}
                          >
                            {sideProg.percent >= 100 ? (
                              <>
                                <Crown className="w-3 h-3 text-amber-400" />
                                <span>Диплом</span>
                              </>
                            ) : (
                              <>
                                <Medal className="w-3 h-3 text-slate-300" />
                                <span>Сертификат</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">
                            До 80%: {80 - sideProg.percent}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'
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
                                className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${isSelected
                                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                  }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.type === 'theory' ? (
                                    <BookOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  ) : item.type === 'quiz' ? (
                                    <GraduationCap className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
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
              {currentItem.type === 'quiz' ? (
                <QuizView
                  key={currentItem.id}
                  item={currentItem}
                  isCompleted={completedItems.includes(currentItem.id)}
                  onComplete={() => markItemCompleted(currentItem.id)}
                  onNext={goToNextItem}
                />
              ) : currentItem.type === 'theory' ? (
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

                    <CommunitySolutionsPanel
                      key={currentItem.id}
                      item={currentItem}
                      isUnlocked={allTestsPassed || completedItems.includes(currentItem.id)}
                      currentCode={currentCode}
                      verifiedCode={verifiedCodeMap[currentItem.id] ?? null}
                      publishState={publishState}
                      refreshNonce={solutionsNonce}
                      onPublish={handleManualPublish}
                      onLoadCode={(code) => {
                        handleCodeChange(code);
                        setTestResults(null);
                      }}
                    />

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
                  </div>

                  <div className="p-6 flex flex-col gap-4 bg-slate-950/60">
                    <div className="flex-1 min-h-[260px]">
                      <CodeEditor
                        code={currentCode}
                        onChange={handleCodeChange}
                        language={currentCourse.language}
                        onReset={() => handleCodeChange(currentItem.initialCode || '')}
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
                              className={`p-3 rounded-lg border ${r.passed
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

        {currentUser && activeTab === 'certificate' && (
          <CertificateView
            course={currentCourse}
            studentName={studentName}
            setStudentName={setStudentName}
            progressPercent={getCourseProgress(currentCourse).percent}
            onBackToLearn={() => setActiveTab('learn')}
          />
        )}
      </main>

      {(activeTab !== 'learn' || !currentUser) && (
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
                    className={`w-full flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors cursor-pointer ${active ? 'text-blue-300' : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                    <span
                      className={`grid place-items-center w-10 h-6 rounded-full transition-colors ${active ? 'bg-blue-600/25' : ''
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