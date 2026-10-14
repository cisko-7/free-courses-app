"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
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
  Settings
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

type TabType = 'dashboard' | 'catalog' | 'my-learning' | 'certificates' | 'learn' | 'certificate';

// --- СТАНДАРТНАЯ БАЗА КУРСОВ ---


const COURSES_DATA: Course[] = [
  {
    "id": "cpp-basics",
    "title": "C++: С нуля до первого проекта",
    "language": "C++",
    "langKey": "cpp",
    "level": "Начинающий",
    "duration": "14 часов",
    "accent": "from-blue-600 to-cyan-500",
    "badgeBg": "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "description": "Фундаментальный практический курс по современному C++ (C++17/20). Потоки ввода-вывода, управление памятью, динамические массивы std::vector и алгоритмические задачи.",
    "skills": [
      "Синтаксис C++17",
      "Потоки iostream",
      "std::vector",
      "Алгоритмы"
    ],
    "modules": [
      {
        "id": "cpp-mod-1",
        "title": "Модуль 1. Основы синтаксиса C++",
        "items": [
          {
            "id": "cpp-1-theory",
            "title": "Структура программы, iostream и переменные",
            "type": "theory",
            "content": "# Введение в современный C++\n\nКаждая программа на C++ начинается с функции `main()`.\n\n```cpp\n#include <iostream>\n\nint main() {\n    std::cout << \"Привет, мир C++!\" << std::endl;\n    return 0;\n}\n```"
          },
          {
            "id": "cpp-1-task-1",
            "title": "Задача: Сумма двух чисел",
            "type": "task",
            "content": "# Задача: Сумма двух чисел\n\nСчитайте два целых числа $A$ и $B$ из `std::cin` и выведите их сумму.",
            "initialCode": "#include <iostream>\n\nint main() {\n    int a, b;\n    // Ваш код здесь\n    return 0;\n}",
            "solution": "#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) std::cout << (a + b) << \"\\n\";\n    return 0;\n}",
            "tests": [
              {
                "input": "2 3",
                "expected": "5"
              },
              {
                "input": "10 -4",
                "expected": "6"
              }
            ]
          },
          {
            "id": "item-91941",
            "title": "Новая задача (Практика)",
            "type": "task",
            "content": "# Условие задачи\n\nОпишите, что должна делать программа и какие данные подаются на вход.",
            "initialCode": "#include <iostream>\n\nint main() {\n    // Напишите ваш код здесь\n    return 0;\n}",
            "solution": "#include <iostream>\n\nint main() {\n    std::cout << \"OK\\n\";\n    return 0;\n}",
            "tests": [
              {
                "input": "1",
                "expected": "OK"
              }
            ]
          },
          {
            "id": "item-95565",
            "title": "Новый урок (Теория)",
            "type": "theory",
            "content": "# Заголовок урока\n\nТекст урока с поддержкой **Markdown** и блоков кода.",
            "initialCode": "// Код по умолчанию\n",
            "solution": "// Решение\n",
            "tests": [
              {
                "input": "1",
                "expected": "1"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "python-basics",
    "title": "Python: Основы, алгоритмы и скрипты",
    "language": "Python",
    "langKey": "python",
    "level": "Начинающий",
    "duration": "12 часов",
    "accent": "from-amber-500 to-yellow-400",
    "badgeBg": "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "description": "Практический старт в Python 3: чистый синтаксис, динамическая типизация, f-строки, списки и написание функций.",
    "skills": [
      "Python 3",
      "f-строки",
      "Списки (Lists)",
      "Функции"
    ],
    "modules": [
      {
        "id": "py-mod-1",
        "title": "Модуль 1. Быстрый старт в Python",
        "items": [
          {
            "id": "py-1-theory",
            "title": "Переменные, f-строки и условия",
            "type": "theory",
            "content": "# Основы языка Python\n\nВ Python блоки кода выделяются отступами.\n\n```python\nname = \"Кирилл\"\nprint(f\"Привет, {name}!\")\n```"
          },
          {
            "id": "py-1-task-1",
            "title": "Задача: Приветствие разработчика",
            "type": "task",
            "content": "# Задача: Приветствие разработчика\n\nСчитайте имя через `input()` и выведите `Привет, <имя>!`.",
            "initialCode": "name = input()\n# Выведите приветствие:\n",
            "solution": "name = input().strip()\nprint(f\"Привет, {name}!\")",
            "tests": [
              {
                "input": "Кирилл",
                "expected": "Привет, Кирилл!"
              },
              {
                "input": "Анна",
                "expected": "Привет, Анна!"
              }
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const pistonLang = langKey === 'cpp' ? 'c++' : 'python';
    const pistonVersion = langKey === 'cpp' ? '10.2.0' : '3.10.0';

    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang,
        version: pistonVersion,
        files: [{ content: cleanCode }],
        stdin: stdinInput
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.run) {
        if (data.compile && data.compile.code !== 0) {
          return {
            stdout: '',
            stderr: data.compile.stderr || data.compile.output || 'Ошибка компиляции',
            engine: 'Piston Cloud'
          };
        }
        return {
          stdout: (data.run.stdout || '').trim(),
          stderr: (data.run.stderr || '').trim(),
          engine: 'Piston Cloud'
        };
      }
    }
  } catch {
    // При отсутствии сети переходим на локальный симулятор
  }

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

  // Поддержка кастомных задач, созданных в Админ-панели
  if (referenceSolution) {
    const normalize = (s: string) => s.replace(/\s+/g, '');
    if (normalize(stripped) === normalize(referenceSolution)) {
      return { stdout: expectedOutput, stderr: '', engine: 'Local Sandbox' };
    }
  }

  return { stdout: '', stderr: '', engine: 'Local Sandbox' };
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
    const actual = res.stdout.trim();
    const expected = test.expected.trim();
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
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2.5 flex-shrink-0" />
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
}

function CodeEditor({ code, onChange, language, onReset, onFillSolution }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCount = Math.max((code || '').split('\n').length, 12);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          aria-hidden="true"
          className="select-none py-4 px-3 text-right bg-slate-950/60 text-slate-600 border-r border-slate-800/80 font-mono text-xs leading-6"
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

        const orb1 = ctx.createRadialGradient(300, 250, 20, 300, 250, 550);
        orb1.addColorStop(0, 'rgba(59, 130, 246, 0.22)');
        orb1.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = orb1;
        ctx.fillRect(0, 0, 2000, 1414);

        const orb2 = ctx.createRadialGradient(1700, 1150, 20, 1700, 1150, 550);
        orb2.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
        orb2.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = orb2;
        ctx.fillRect(0, 0, 2000, 1414);

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 6;
        ctx.strokeRect(70, 70, 1860, 1274);

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.strokeRect(92, 92, 1816, 1230);

        const corners: Array<[number, number]> = [
          [70, 70],
          [1930, 70],
          [70, 1344],
          [1930, 1344]
        ];
        ctx.fillStyle = '#eab308';
        corners.forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fill();
        });

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

        const displayName = (studentName || 'Иван Иванов').trim();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'italic bold 86px serif';
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
        ctx.font = 'bold 58px sans-serif';
        ctx.fillText(`«${course.title}»`, 1000, 815);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px sans-serif';
        ctx.fillText(`Язык программирования: ${course.language} • Уровень: ${course.level} • Выполнено 100% задач`, 1000, 890);

        ctx.save();
        ctx.beginPath();
        ctx.arc(1000, 1110, 85, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#eab308';
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('VERIFIED', 1000, 1105);
        ctx.font = '20px sans-serif';
        ctx.fillText('100% PASSED', 1000, 1135);
        ctx.restore();

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
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Например: Кирилл Горгос"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none text-white font-medium"
          />
        </div>

        <button
          onClick={handleDownloadCertificate}
          disabled={isDownloading}
          className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
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

  // Асинхронная гидратация из LocalStorage (синхронизировано с /admin)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedEnrolled = localStorage.getItem('dc_enrolled');
        const savedCompleted = localStorage.getItem('dc_completed');
        const savedCode = localStorage.getItem('dc_code_map');
        const savedName = localStorage.getItem('dc_student_name');
        const savedCustomCourses = localStorage.getItem('dc_custom_courses');

        if (savedCustomCourses) {
          const parsed: Course[] = JSON.parse(savedCustomCourses);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCoursesList(parsed);
          }
        }
        if (savedEnrolled) setEnrolledCourses(JSON.parse(savedEnrolled));
        if (savedCompleted) setCompletedItems(JSON.parse(savedCompleted));
        if (savedCode) setUserCodeMap(JSON.parse(savedCode));
        if (savedName) setStudentName(savedName);
      } catch {
        // Игнорируем ошибки доступа к localStorage
      } finally {
        setIsHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem('dc_enrolled', JSON.stringify(enrolledCourses));
      localStorage.setItem('dc_completed', JSON.stringify(completedItems));
      localStorage.setItem('dc_code_map', JSON.stringify(userCodeMap));
      localStorage.setItem('dc_student_name', studentName);
    } catch {
      // Игнорируем ошибки переполнения квоты
    }
  }, [enrolledCourses, completedItems, userCodeMap, studentName, isHydrated]);

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
    if (!completedItems.includes(itemId)) {
      setCompletedItems((prev) => [...prev, itemId]);
    }
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
    if (!currentItem || currentItem.type !== 'task') return;
    setIsRunningTests(true);
    setTestResults(null);

    const results = await runTests(
      currentCourse.langKey,
      currentCode,
      currentItem.tests || [],
      currentItem.id,
      currentItem.solution
    );

    setTestResults(results);
    setIsRunningTests(false);

    if (results.length > 0 && results.every((r: TestResult) => r.passed)) {
      markItemCompleted(currentItem.id);
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

  const navItems: Array<{ id: TabType; label: string }> = [
    { id: 'dashboard', label: 'Дашборд' },
    { id: 'catalog', label: 'Магазин курсов' },
    { id: 'my-learning', label: 'Моё обучение' },
    { id: 'certificates', label: 'Сертификаты' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col selection:bg-blue-500 selection:text-white">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Code2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white block leading-none">DevCourses</span>
                <span className="text-[11px] text-slate-400 font-mono">Interactive IDE • SSG</span>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((nav) => (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === nav.id
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {nav.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Пройдено шагов:</span>
              <span className="font-bold text-white">{completedItems.length}</span>
            </div>

            <button
              onClick={handleDemoUnlockAll}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Демо: Открыть всё</span>
            </button>

            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Админ-панель</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {(activeTab === 'dashboard' ||
          activeTab === 'catalog' ||
          activeTab === 'my-learning' ||
          activeTab === 'certificates') && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
            {activeTab === 'dashboard' && (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/60 p-6 sm:p-10 shadow-2xl">
                <div className="max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Интерактивная платформа • Работает без VPN</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                    Учись программировать, решая задачи в браузере
                  </h1>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    Структурированная теория по C++ и Python, встроенный редактор кода с автопроверкой тестов и именные сертификаты.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3">
                    <button
                      onClick={() => handleEnrollAndOpen(coursesList[0]?.id || 'cpp-basics')}
                      className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Начать обучение</span>
                    </button>
                    <Link
                      href="/admin"
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 flex items-center gap-2 transition-all"
                    >
                      <Settings className="w-4 h-4 text-indigo-400" />
                      <span>Конструктор курсов (Админка)</span>
                    </Link>
                  </div>
                </div>
              </div>
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
                          className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-5 shadow-lg"
                        >
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
                    <span>Магазин / Каталог курсов</span>
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
                        className="group rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-blue-500/60 transition-all p-6 flex flex-col justify-between gap-6 shadow-xl"
                      >
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
                      <span>Отметить как изученное и перейти далее</span>
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
                          <span>Задача решена (Перейти далее)</span>
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
    </div>
  );
}