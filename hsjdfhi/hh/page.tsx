"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Code2,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Send,
  Copy,
  Check,
  BookOpen,
  Award,
  ChevronRight,
  Lock,
  Zap,
  Layers,
  Play,
  Search,
  AlertTriangle,
  Flame
} from 'lucide-react';

/* ============================================================
   НАСТРОЙКИ ЗАГЛУШКИ — меняются здесь, в коде, и действуют для ВСЕХ посетителей.
   (Раньше «настройки экрана» сохранялись в localStorage и менялись только у вас в браузере.)

   Дата запуска задаётся переменной окружения при сборке, например:
   NEXT_PUBLIC_LAUNCH_AT=2026-11-01T12:00:00+03:00
   Если она не задана — таймер просто не показывается.
   ============================================================ */

const CONFIG = {
  headline: 'DevCourses скоро откроется: готовим курсы по C++ и Python',
  subheadline:
    'Мы наполняем платформу теорией и практическими задачами с автопроверкой. Оставьте контакт — напишем, когда сайт заработает.',
  // Число от 1 до 99 покажет полосу прогресса. null — полоса скрыта (не показываем выдуманные проценты).
  progress: null as number | null,
  launchAt: process.env.NEXT_PUBLIC_LAUNCH_AT ?? ''
};

const LAUNCH_TS = Date.parse(CONFIG.launchAt); // NaN, если не задано или записано неверно

// --- ТИПЫ ---

type Lang = 'C++' | 'Python';
type WaitlistLang = Lang | 'C++ и Python';
type SectionId = 'quiz' | 'cheatsheets' | 'roadmap' | 'terminal';

interface BlitzQuestion {
  id: string;
  language: Lang;
  difficulty: 'Лёгкий' | 'Средний';
  question: string;
  codeSnippet: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  xpReward: number;
}

interface CheatSheetItem {
  id: string;
  language: Lang;
  category: string;
  title: string;
  description: string;
  code: string;
}

interface RoadmapMilestone {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: 'done' | 'in-progress' | 'planned';
  dateLabel: string;
  items: string[];
}

interface TerminalLog {
  id: string;
  timestamp: string;
  command?: string;
  output: string;
  type: 'info' | 'success' | 'warn';
}

interface JoinedInfo {
  name: string;
  lang: WaitlistLang;
  contact?: string; // контакт показываем только в текущей сессии и не храним в браузере
}

// --- БЕЗОПАСНАЯ РАБОТА С localStorage (самодостаточно, без внешних файлов) ---

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* хранилище недоступно — не критично */
    }
  }
};

const KEYS = {
  xp: 'dc_maint_xp',
  answered: 'dc_maint_answered',
  joined: 'dc_maint_joined'
} as const;

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

const WAITLIST_LANGS: WaitlistLang[] = ['C++', 'Python', 'C++ и Python'];

function parseJoined(raw: string | null): JoinedInfo | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    if (typeof o.name !== 'string' || !WAITLIST_LANGS.includes(o.lang as WaitlistLang)) return null;
    return { name: o.name.slice(0, 60), lang: o.lang as WaitlistLang };
  } catch {
    return null;
  }
}

// --- ПРОВЕРКА КОНТАКТА ---

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const TELEGRAM_RE = /^@[A-Za-z0-9_]{5,32}$/;

// --- ДАННЫЕ: БЛИЦ-ЗАДАЧИ ---

const BLITZ_QUESTIONS: BlitzQuestion[] = [
  {
    id: 'q-cpp-1',
    language: 'C++',
    difficulty: 'Лёгкий',
    question: 'Что выведет эта программа?',
    codeSnippet: `#include <iostream>
#include <vector>

int main() {
    std::vector<int> v = {10, 20, 30};
    v.push_back(40);
    v.pop_back();
    std::cout << v.size() << " : " << v.back();
    return 0;
}`,
    options: ['4 : 40', '3 : 30', '3 : 40', '2 : 20'],
    correctIndex: 1,
    explanation:
      'push_back(40) добавил четвёртый элемент, но pop_back() сразу удалил последний. В векторе осталось 3 элемента, а v.back() равен 30.',
    xpReward: 50
  },
  {
    id: 'q-cpp-2',
    language: 'C++',
    difficulty: 'Средний',
    question: 'Чему равна x после вызова функции?',
    codeSnippet: `#include <iostream>

void addTen(int& num) {
    num += 10;
}

int main() {
    int x = 15;
    addTen(x);
    std::cout << x;
    return 0;
}`,
    options: ['15', '10', '25', 'Ошибка компиляции'],
    correctIndex: 2,
    explanation:
      'Параметр int& принимает переменную по ссылке, а не копирует её. Изменение num внутри функции меняет x в main(): 15 + 10 = 25.',
    xpReward: 75
  },
  {
    id: 'q-py-1',
    language: 'Python',
    difficulty: 'Лёгкий',
    question: 'Какой список создаст это выражение?',
    codeSnippet: `nums = [x ** 2 for x in range(1, 6) if x % 2 == 0]
print(nums)`,
    options: ['[1, 4, 9, 16, 25]', '[2, 4]', '[4, 16]', '[4, 16, 36]'],
    correctIndex: 2,
    explanation:
      'range(1, 6) перебирает числа от 1 до 5. Условие x % 2 == 0 оставляет чётные (2 и 4), а x ** 2 возводит их в квадрат: [4, 16].',
    xpReward: 50
  },
  {
    id: 'q-cpp-3',
    language: 'C++',
    difficulty: 'Средний',
    question: 'Какова сложность одного вызова push_back() у std::vector?',
    codeSnippet: `std::vector<int> data;
for (int i = 0; i < n; ++i) {
    data.push_back(i);
}`,
    options: [
      'O(1) амортизированная',
      'Всегда O(N)',
      'O(log N)',
      'O(N^2)'
    ],
    correctIndex: 0,
    explanation:
      'Вектор выделяет память с запасом и увеличивает capacity в 1,5–2 раза при переполнении, поэтому амортизированная сложность push_back() — O(1).',
    xpReward: 75
  },
  {
    id: 'q-py-2',
    language: 'Python',
    difficulty: 'Лёгкий',
    question: 'Что выведет срез с отрицательным шагом?',
    codeSnippet: `word = "C++20"
print(word[::-1])`,
    options: ['C++20', '02++C', 'C++2', 'IndexError'],
    correctIndex: 1,
    explanation:
      'Срез [::-1] идёт по строке от конца к началу с шагом -1 и разворачивает её: "02++C".',
    xpReward: 50
  }
];

// --- ДАННЫЕ: ШПАРГАЛКИ ---

const CHEAT_SHEETS: CheatSheetItem[] = [
  {
    id: 'cs-cpp-io',
    language: 'C++',
    category: 'Ввод и вывод',
    title: 'Быстрый ввод и вывод для больших данных',
    description:
      'Отключение синхронизации потоков C и C++ заметно ускоряет чтение больших объёмов данных из std::cin.',
    code: `#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int a, b;
    while (std::cin >> a >> b) {
        std::cout << (a + b) << "\\n";
    }
    return 0;
}`
  },
  {
    id: 'cs-cpp-vec',
    language: 'C++',
    category: 'Контейнеры STL',
    title: 'std::vector, сортировка и поиск максимума',
    description: 'Создание динамического массива, добавление элементов, сортировка по возрастанию и поиск максимума.',
    code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> nums = {42, 7, 19, 3, 88};
    nums.push_back(15);

    std::sort(nums.begin(), nums.end());

    int maxVal = *std::max_element(nums.begin(), nums.end());
    std::cout << "Max: " << maxVal << "\\n";

    for (int x : nums) {
        std::cout << x << " ";
    }
    return 0;
}`
  },
  {
    id: 'cs-cpp-2d',
    language: 'C++',
    category: 'Матрицы',
    title: 'Двумерный вектор: матрица N на M',
    description: 'Таблица из N строк и M столбцов, заполненная нулями, и обход по индексам.',
    code: `#include <iostream>
#include <vector>

int main() {
    int rows = 3, cols = 4;
    std::vector<std::vector<int>> grid(rows, std::vector<int>(cols, 0));

    grid[1][2] = 99;

    for (int r = 0; r < rows; ++r) {
        for (int c = 0; c < cols; ++c) {
            std::cout << grid[r][c] << " ";
        }
        std::cout << "\\n";
    }
    return 0;
}`
  },
  {
    id: 'cs-py-list',
    language: 'Python',
    category: 'Структуры данных',
    title: 'Чтение чисел в одну строку и списковые включения',
    description: 'Типовой шаблон чтения массива чисел из стандартного ввода для алгоритмических задач.',
    code: `# Целые числа, введённые через пробел:
nums = list(map(int, input().split()))

# Квадраты чётных:
even_squares = [x ** 2 for x in nums if x % 2 == 0]

print(f"Сумма: {sum(nums)}, максимум: {max(nums)}")
print("Квадраты чётных:", *even_squares)`
  },
  {
    id: 'cs-py-dict',
    language: 'Python',
    category: 'Словари',
    title: 'Подсчёт частоты элементов через словарь',
    description: 'Сколько раз каждое слово или число встретилось в последовательности.',
    code: `words = ["cpp", "python", "cpp", "stl", "cpp", "python"]
freq = {}

for w in words:
    freq[w] = freq.get(w, 0) + 1

for key, count in freq.items():
    print(f"{key}: {count}")`
  }
];

// --- ДАННЫЕ: ПЛАН РЕЛИЗА ---

const ROADMAP_STEPS: RoadmapMilestone[] = [
  {
    id: 'rm-1',
    phase: 'Готово',
    title: 'Ядро платформы',
    description: 'Собрана основа: курсы, аккаунты, облачная база и сертификаты.',
    status: 'done',
    dateLabel: 'Завершено',
    items: [
      'Облачная база данных Supabase',
      'Студия для создания курсов и тестов',
      'Генератор именных сертификатов в формате PNG'
    ]
  },
  {
    id: 'rm-2',
    phase: 'В работе',
    title: 'Наполнение курсов',
    description: 'Добавляем модули с теорией и задачами, подключаем сервер автопроверки кода.',
    status: 'in-progress',
    dateLabel: 'Сейчас',
    items: [
      'Модули по C++: ссылки, указатели, std::vector, потоки',
      'Модули по Python 3: структуры данных, функции, алгоритмы',
      'Сервер запуска и проверки решений'
    ]
  },
  {
    id: 'rm-3',
    phase: 'Дальше',
    title: 'Открытие платформы',
    description: 'Публичный запуск и новые треки для тех, кто прошёл основы.',
    status: 'planned',
    dateLabel: 'Скоро',
    items: [
      'Сообщение о запуске участникам списка ожидания',
      'Рейтинг учеников по очкам опыта',
      'Треки по алгоритмам и структурам данных'
    ]
  }
];

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'quiz', label: 'Блиц-тренажёр', icon: Play },
  { id: 'cheatsheets', label: 'Шпаргалки', icon: BookOpen },
  { id: 'roadmap', label: 'План релиза', icon: Layers },
  { id: 'terminal', label: 'Консоль', icon: Terminal }
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function MaintenancePortalPage() {
  // Таймер: now = null до монтирования, чтобы не было расхождения при гидратации статической страницы
  const [now, setNow] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('quiz');
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);

  // Форма списка ожидания
  const [subName, setSubName] = useState<string>('');
  const [subContact, setSubContact] = useState<string>('');
  const [subLang, setSubLang] = useState<WaitlistLang>('C++ и Python');
  const [consent, setConsent] = useState<boolean>(false);
  const [honeypot, setHoneypot] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinedInfo | null>(null);
  const lastSubmitAt = useRef<number>(0);

  // Блиц-тренажёр
  const [currentQuizIdx, setCurrentQuizIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [earnedXp, setEarnedXp] = useState<number>(0);

  // Шпаргалки
  const [sheetFilter, setSheetFilter] = useState<'ALL' | Lang>('ALL');
  const [sheetSearch, setSheetSearch] = useState<string>('');
  const [copiedSheetId, setCopiedSheetId] = useState<string | null>(null);

  // Консоль
  const [terminalInput, setTerminalInput] = useState<string>('');
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([
    {
      id: 'init-1',
      timestamp: '00:00:01',
      output: 'Консоль DevCourses. Введите «help», чтобы увидеть команды.',
      type: 'info'
    }
  ]);
  const terminalBoxRef = useRef<HTMLDivElement>(null);

  // Сохранённые данные (только безопасные и проверенные)
  useEffect(() => {
    queueMicrotask(() => {
      const savedXp = Number(store.get(KEYS.xp));
      if (Number.isFinite(savedXp) && savedXp > 0) setEarnedXp(Math.min(savedXp, 100000));

      try {
        const rawAnswered = store.get(KEYS.answered);
        const parsed: unknown = rawAnswered ? JSON.parse(rawAnswered) : null;
        if (isStringArray(parsed)) setAnsweredIds(parsed.slice(0, 50));
      } catch {
        /* повреждённые данные игнорируем */
      }

      const savedJoined = parseJoined(store.get(KEYS.joined));
      if (savedJoined) setJoined(savedJoined);
    });
  }, []);

  // Показываем ссылку на студию только администратору (реальная защита — вход через Supabase)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminUser(session?.user?.app_metadata?.role === 'admin');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Тик таймера — только если задана корректная дата запуска
  useEffect(() => {
    if (!Number.isFinite(LAUNCH_TS)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!Number.isFinite(LAUNCH_TS) || now === null) return null;
    const total = Math.max(0, Math.floor((LAUNCH_TS - now) / 1000));
    return {
      finished: total === 0,
      days: pad2(Math.floor(total / 86400)),
      hours: pad2(Math.floor((total % 86400) / 3600)),
      minutes: pad2(Math.floor((total % 3600) / 60)),
      seconds: pad2(total % 60)
    };
  }, [now]);

  const launchLabel = useMemo(
    () =>
      Number.isFinite(LAUNCH_TS)
        ? new Date(LAUNCH_TS).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
    []
  );

  // Автопрокрутка консоли внутри её контейнера (без прокрутки всей страницы)
  useEffect(() => {
    const box = terminalBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [terminalLogs, activeSection]);

  // --- Очки разминки ---

  const awardXp = (amount: number, id: string) => {
    if (answeredIds.includes(id)) return;
    const nextXp = earnedXp + amount;
    const nextAnswered = [...answeredIds, id];
    setEarnedXp(nextXp);
    setAnsweredIds(nextAnswered);
    store.set(KEYS.xp, String(nextXp));
    store.set(KEYS.answered, JSON.stringify(nextAnswered));
  };

  // --- Форма списка ожидания ---

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = subName.trim();
    let contact = subContact.trim();

    // Поле-приманка для ботов: человек его не видит и не заполняет
    if (honeypot) {
      setJoined({ name: name || 'друг', lang: subLang });
      return;
    }

    if (!name || name.length > 60) {
      setFormError('Введите имя или никнейм, не длиннее 60 символов.');
      return;
    }
    if (EMAIL_RE.test(contact)) {
      contact = contact.toLowerCase();
    } else if (!TELEGRAM_RE.test(contact)) {
      setFormError('Укажите email (name@mail.ru) или Telegram в формате @username.');
      return;
    }
    if (!consent) {
      setFormError('Нужно согласие на использование контакта для сообщения о запуске.');
      return;
    }
    if (Date.now() - lastSubmitAt.current < 30000) {
      setFormError('Заявка уже отправляется. Подождите полминуты и повторите.');
      return;
    }

    lastSubmitAt.current = Date.now();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('waitlist_subscribers').insert({
        name,
        contact,
        preferred_lang: subLang,
        consent: true
      });

      // 23505 — такой контакт уже в списке: для пользователя это тоже успех
      if (error && error.code !== '23505') {
        setFormError('Не удалось отправить заявку. Попробуйте ещё раз чуть позже.');
        return;
      }

      store.set(KEYS.joined, JSON.stringify({ name, lang: subLang }));
      setJoined({ name, lang: subLang, contact });
      setSubName('');
      setSubContact('');
      setConsent(false);
    } catch {
      setFormError('Нет соединения с сервером. Проверьте интернет и повторите.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Блиц-тренажёр ---

  const currentQuiz = BLITZ_QUESTIONS[currentQuizIdx];

  const handleSelectQuizOption = (idx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    if (idx === currentQuiz.correctIndex) awardXp(currentQuiz.xpReward, currentQuiz.id);
  };

  const handleNextQuiz = () => {
    setSelectedOption(null);
    setCurrentQuizIdx((prev) => (prev + 1) % BLITZ_QUESTIONS.length);
  };

  // --- Шпаргалки ---

  const filteredSheets = useMemo(() => {
    const q = sheetSearch.trim().toLowerCase();
    return CHEAT_SHEETS.filter((item) => {
      const matchesLang = sheetFilter === 'ALL' || item.language === sheetFilter;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesLang && matchesSearch;
    });
  }, [sheetFilter, sheetSearch]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopiedSheetId(id);
        setTimeout(() => setCopiedSheetId(null), 2000);
      })
      .catch(() => {
        /* копирование запрещено браузером */
      });
  };

  // --- Консоль ---

  const executeTerminalCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim().toLowerCase();
    if (!cmd) return;

    if (cmd === 'clear') {
      setTerminalLogs([]);
      setTerminalInput('');
      return;
    }

    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    let reply: string;
    let type: TerminalLog['type'] = 'info';

    switch (cmd) {
      case 'help':
        reply = 'Команды: launch (дата запуска), roadmap (план), bonus (очки разминки), clear (очистить).';
        break;
      case 'launch':
        reply = launchLabel ? `Запуск запланирован на ${launchLabel}.` : 'Дата запуска пока не назначена.';
        type = 'success';
        break;
      case 'roadmap':
        reply = ROADMAP_STEPS.map((s) => `${s.phase}: ${s.title}`).join('  →  ');
        break;
      case 'bonus':
        if (answeredIds.includes('terminal-secret')) {
          reply = 'Бонус из консоли вы уже получали.';
          type = 'warn';
        } else {
          awardXp(50, 'terminal-secret');
          reply = 'Найден секрет консоли: +50 очков разминки.';
          type = 'success';
        }
        break;
      default:
        reply = `Команда «${rawCmd.slice(0, 40)}» не распознана. Введите «help».`;
        type = 'warn';
    }

    setTerminalLogs((prev) => [
      ...prev.slice(-49),
      { id: `cmd-${Date.now()}`, timestamp: time, command: rawCmd.slice(0, 40), output: reply, type }
    ]);
    setTerminalInput('');
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none';

  return (
    <div className="min-h-screen text-slate-200 flex flex-col relative overflow-x-hidden">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Code2 className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">DevCourses</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                  Сайт в разработке
                </span>
              </div>
              <span className="text-xs text-slate-400 hidden sm:block truncate">
                Интерактивные курсы по C++ и Python
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
              title="Очки за блиц-задачи. Хранятся только в вашем браузере."
            >
              <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="text-slate-400 hidden sm:inline">Очки разминки:</span>
              <span className="font-bold text-amber-300 font-mono">{earnedXp}</span>
            </div>

            {isAdminUser && (
              <Link
                href="/admin"
                className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Студия</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 relative z-10">
        {/* Главный блок: статус, таймер и форма */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch" aria-labelledby="hero-title">
          <div className="lg:col-span-7 p-6 sm:p-10 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl flex flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>Платформа пока закрыта: идёт наполнение курсами</span>
              </div>

              <h1
                id="hero-title"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight"
              >
                {CONFIG.headline}
              </h1>

              <p className="text-slate-300 text-base leading-relaxed max-w-prose">{CONFIG.subheadline}</p>

              {CONFIG.progress !== null && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">Готовность платформы</span>
                    <span className="font-mono font-bold text-emerald-400">{CONFIG.progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Готовность платформы"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={CONFIG.progress}
                    className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800"
                  >
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${CONFIG.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Таймер до запуска — настоящий, до одной общей даты */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Clock className="w-4 h-4 text-blue-400" aria-hidden="true" />
                <span>
                  {launchLabel ? `До запуска, ${launchLabel}` : 'Дата запуска пока не назначена'}
                </span>
              </div>

              {countdown && !countdown.finished && (
                <div className="grid grid-cols-4 gap-3 sm:gap-4" aria-hidden="true">
                  {[
                    { value: countdown.days, label: 'дней' },
                    { value: countdown.hours, label: 'часов' },
                    { value: countdown.minutes, label: 'минут' },
                    { value: countdown.seconds, label: 'секунд' }
                  ].map((unit) => (
                    <div
                      key={unit.label}
                      className="p-3 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800 text-center"
                    >
                      <div className="text-2xl sm:text-4xl font-mono font-extrabold text-white">
                        {unit.value}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{unit.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {countdown?.finished && (
                <p className="text-sm text-emerald-300">Назначенное время наступило — открытие совсем близко.</p>
              )}
            </div>
          </div>

          {/* Форма списка ожидания */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Список ожидания</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Узнайте о запуске первыми</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Оставьте email или Telegram — напишем один раз, когда платформа откроется.
              </p>
            </div>

            {!joined ? (
              <form onSubmit={handleWaitlistSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="wl-name" className="block text-sm font-semibold text-slate-300">
                    Имя или никнейм
                  </label>
                  <input
                    id="wl-name"
                    type="text"
                    required
                    maxLength={60}
                    autoComplete="given-name"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Например, Кирилл"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="wl-contact" className="block text-sm font-semibold text-slate-300">
                    Email или Telegram
                  </label>
                  <input
                    id="wl-contact"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="email"
                    value={subContact}
                    onChange={(e) => setSubContact(e.target.value)}
                    placeholder="name@mail.ru или @username"
                    className={inputClass}
                  />
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="block text-sm font-semibold text-slate-300 mb-1.5">
                    Какой курс ждёте
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {WAITLIST_LANGS.map((langOpt) => (
                      <button
                        key={langOpt}
                        type="button"
                        aria-pressed={subLang === langOpt}
                        onClick={() => setSubLang(langOpt)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                          subLang === langOpt
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {langOpt}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Поле-приманка для ботов: скрыто от людей и скринридеров */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="wl-website">Сайт</label>
                  <input
                    id="wl-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <span>
                    Согласен, что DevCourses использует мой контакт только для сообщения о запуске
                    платформы.
                  </span>
                </label>

                {formError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Отправляем…' : 'Сообщите мне о запуске'}</span>
                </button>
              </form>
            ) : (
              <div role="status" className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-bold text-white">Вы в списке, {joined.name}</h3>
                    <p className="text-sm text-slate-300 mt-1">
                      Напишем, когда откроется курс «{joined.lang}»
                      {joined.contact ? (
                        <>
                          {' '}
                          на <span className="text-emerald-300 font-mono break-all">{joined.contact}</span>
                        </>
                      ) : null}
                      .
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setJoined(null);
                    store.set(KEYS.joined, '');
                  }}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Добавить другой контакт
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Интерактивные разделы */}
        <section className="space-y-6" aria-labelledby="extras-title">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 id="extras-title" className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-amber-400" aria-hidden="true" />
                <span>Потренируйтесь, пока ждёте</span>
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-prose">
                Блиц-задачи, шпаргалки и план релиза доступны без регистрации.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Разделы"
              className="flex flex-wrap gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800"
            >
              {SECTIONS.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setActiveSection(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Блиц-тренажёр */}
          {activeSection === 'quiz' && (
            <div
              role="tabpanel"
              id="panel-quiz"
              aria-labelledby="tab-quiz"
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {currentQuiz.language}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                      {currentQuiz.difficulty}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    +{currentQuiz.xpReward} очков за верный ответ
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-white">
                  Задача {currentQuizIdx + 1} из {BLITZ_QUESTIONS.length}. {currentQuiz.question}
                </h3>

                <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-emerald-300 overflow-x-auto leading-relaxed">
                  <code>{currentQuiz.codeSnippet}</code>
                </pre>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQuiz.options.map((option, idx) => {
                    const isPicked = selectedOption === idx;
                    const isCorrect = idx === currentQuiz.correctIndex;
                    let btnStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-blue-500/50';
                    if (selectedOption !== null) {
                      if (isCorrect) btnStyle = 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-bold';
                      else if (isPicked) btnStyle = 'bg-rose-950/50 border-rose-500 text-rose-200';
                      else btnStyle = 'bg-slate-950 border-slate-800 text-slate-500';
                    }
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectQuizOption(idx)}
                        aria-disabled={selectedOption !== null}
                        className={`p-4 rounded-xl border text-left font-mono text-xs sm:text-sm transition-colors flex items-center justify-between gap-2 ${btnStyle}`}
                      >
                        <span>{option}</span>
                        {selectedOption !== null && isCorrect && (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                            <span className="sr-only">Верный ответ</span>
                          </>
                        )}
                        {isPicked && !isCorrect && <span className="sr-only">Ваш ответ, неверно</span>}
                      </button>
                    );
                  })}
                </div>

                <div aria-live="polite">
                  {selectedOption !== null && (
                    <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-3">
                      <div className="text-sm font-bold text-blue-300">
                        {selectedOption === currentQuiz.correctIndex ? 'Верно. Разбор:' : 'Не совсем. Разбор:'}
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{currentQuiz.explanation}</p>
                      <div className="flex justify-end">
                        <button
                          onClick={handleNextQuiz}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <span>Следующая задача</span>
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Award className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Ваша разминка</h4>
                    <p className="text-xs text-slate-400">Очки хранятся только в вашем браузере</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Решено задач</span>
                    <span className="font-bold text-white font-mono">
                      {answeredIds.filter((id) => id.startsWith('q-')).length} / {BLITZ_QUESTIONS.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Очков разминки</span>
                    <span className="font-bold text-amber-400 font-mono">{earnedXp}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400">Все задачи</span>
                  {BLITZ_QUESTIONS.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentQuizIdx(i);
                        setSelectedOption(null);
                      }}
                      aria-current={currentQuizIdx === i}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        currentQuizIdx === i
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                          : 'bg-slate-950/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>
                        {i + 1}. {q.language}, {q.difficulty.toLowerCase()}
                      </span>
                      {answeredIds.includes(q.id) && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                          <span className="sr-only">решена</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Шпаргалки */}
          {activeSection === 'cheatsheets' && (
            <div role="tabpanel" id="panel-cheatsheets" aria-labelledby="tab-cheatsheets" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {(['ALL', 'C++', 'Python'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSheetFilter(lang)}
                      aria-pressed={sheetFilter === lang}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        sheetFilter === lang
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      {lang === 'ALL' ? 'Все языки' : lang}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <label htmlFor="sheet-search" className="sr-only">
                    Поиск по шпаргалкам
                  </label>
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="sheet-search"
                    type="search"
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Поиск: vector, cin, словарь"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {filteredSheets.length === 0 ? (
                <p className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 text-sm text-slate-400">
                  По запросу «{sheetSearch}» ничего не найдено. Попробуйте другое слово или выберите «Все языки».
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredSheets.map((sheet) => (
                    <article
                      key={sheet.id}
                      className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4 shadow-xl"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {sheet.language}: {sheet.category}
                          </span>
                          <button
                            onClick={() => handleCopyCode(sheet.code, sheet.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                          >
                            {copiedSheetId === sheet.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                                <span className="text-emerald-400">Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Копировать</span>
                              </>
                            )}
                          </button>
                        </div>
                        <h3 className="text-lg font-bold text-white">{sheet.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{sheet.description}</p>
                      </div>

                      <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-blue-200 overflow-x-auto leading-relaxed">
                        <code>{sheet.code}</code>
                      </pre>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* План релиза */}
          {activeSection === 'roadmap' && (
            <div
              role="tabpanel"
              id="panel-roadmap"
              aria-labelledby="tab-roadmap"
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {ROADMAP_STEPS.map((step) => (
                <article
                  key={step.id}
                  className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-3 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        step.status === 'done'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : step.status === 'in-progress'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {step.phase}
                    </span>
                    <span className="text-xs text-slate-400">{step.dateLabel}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>

                  <ul className="space-y-2 pt-2">
                    {step.items.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            step.status === 'done'
                              ? 'text-emerald-400'
                              : step.status === 'in-progress'
                              ? 'text-amber-400'
                              : 'text-slate-600'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}

          {/* Консоль */}
          {activeSection === 'terminal' && (
            <div
              role="tabpanel"
              id="panel-terminal"
              aria-labelledby="tab-terminal"
              className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl"
            >
              <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-300">guest@devcourses:~</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['help', 'launch', 'roadmap', 'bonus', 'clear'].map((quickCmd) => (
                    <button
                      key={quickCmd}
                      onClick={() => executeTerminalCommand(quickCmd)}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-mono text-blue-300 transition-colors"
                    >
                      {quickCmd}
                    </button>
                  ))}
                </div>
              </div>

              <div
                ref={terminalBoxRef}
                role="log"
                aria-live="polite"
                className="p-5 font-mono text-xs sm:text-sm space-y-3 h-72 overflow-y-auto"
              >
                {terminalLogs.map((log) => (
                  <div key={log.id} className="space-y-1">
                    {log.command && (
                      <div className="text-slate-400">
                        <span className="text-emerald-400">$</span> {log.command}
                      </div>
                    )}
                    <div
                      className={
                        log.type === 'success'
                          ? 'text-emerald-300'
                          : log.type === 'warn'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }
                    >
                      [{log.timestamp}] {log.output}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeTerminalCommand(terminalInput);
                }}
                className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 font-mono text-sm"
              >
                <span className="text-emerald-400 font-bold" aria-hidden="true">
                  $
                </span>
                <label htmlFor="terminal-input" className="sr-only">
                  Команда
                </label>
                <input
                  id="terminal-input"
                  type="text"
                  maxLength={40}
                  autoComplete="off"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="Введите команду, например help"
                  className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-xs sm:text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-sans font-semibold transition-colors"
                >
                  Выполнить
                </button>
              </form>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/90 py-6 px-4 sm:px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto">
          <span>© 2026 DevCourses. Образовательная платформа по C++ и Python.</span>
        </div>
      </footer>
    </div>
  );
}
