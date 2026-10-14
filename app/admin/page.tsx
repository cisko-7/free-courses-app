"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Trash2,
  BookOpen,
  Terminal,
  ArrowLeft,
  Layers,
  Tag,
  FileCode,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Download,
  Upload,
  FolderPlus,
  Settings,
  CloudUpload,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

// --- СТРОГАЯ ТИПИЗАЦИЯ ---

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

const DEFAULT_COURSES: Course[] = [
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
            content: `# Введение в современный C++\n\nКаждая программа на C++ начинается с функции \`main()\`.\n\n\`\`\`cpp\n#include <iostream>\n\nint main() {\n    std::cout << "Привет, мир C++!" << std::endl;\n    return 0;\n}\n\`\`\``
          },
          {
            id: 'cpp-1-task-1',
            title: 'Задача: Сумма двух чисел',
            type: 'task',
            content: `# Задача: Сумма двух чисел\n\nСчитайте два целых числа $A$ и $B$ из \`std::cin\` и выведите их сумму.`,
            initialCode: `#include <iostream>\n\nint main() {\n    int a, b;\n    // Ваш код здесь\n    return 0;\n}`,
            solution: `#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) std::cout << (a + b) << "\\n";\n    return 0;\n}`,
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
            content: `# Задача: Чётное или нечётное\n\nДано целое число $N$. Если оно делится на 2 без остатка, выведите \`EVEN\`, иначе \`ODD\`.`,
            initialCode: `#include <iostream>\n\nint main() {\n    int n;\n    std::cin >> n;\n    return 0;\n}`,
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
        title: 'Модуль 2. Массивы и std::vector',
        items: [
          {
            id: 'cpp-2-theory',
            title: 'Динамические массивы std::vector',
            type: 'theory',
            content: `# Массивы и std::vector в C++\n\nВ современном C++ используется динамический контейнер \`std::vector\` из библиотеки \`<vector>\`.`
          },
          {
            id: 'cpp-2-task-1',
            title: 'Задача: Максимум в массиве',
            type: 'task',
            content: `# Задача: Максимум в массиве\n\nНайдите максимальный элемент в массиве из $N$ целых чисел.`,
            initialCode: `#include <iostream>\n#include <vector>\n\nint main() {\n    int n;\n    if (!(std::cin >> n)) return 0;\n    std::vector<int> a(n);\n    for (int i = 0; i < n; ++i) std::cin >> a[i];\n    return 0;\n}`,
            solution: `#include <iostream>\n#include <vector>\n\nint main() {\n    int n;\n    if (!(std::cin >> n)) return 0;\n    std::vector<int> a(n);\n    for (int i = 0; i < n; ++i) std::cin >> a[i];\n    int max_val = a[0];\n    for (int i = 1; i < n; ++i) if (a[i] > max_val) max_val = a[i];\n    std::cout << max_val << "\\n";\n    return 0;\n}`,
            tests: [
              { input: '5\n1 9 3 7 2', expected: '9' },
              { input: '3\n-5 -2 -10', expected: '-2' }
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
      'Практический старт в Python 3: чистый синтаксис, динамическая типизация, f-строки, списки и написание функций.',
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
            content: `# Основы языка Python\n\nВ Python блоки кода выделяются отступами.\n\n\`\`\`python\nname = "Кирилл"\nprint(f"Привет, {name}!")\n\`\`\``
          },
          {
            id: 'py-1-task-1',
            title: 'Задача: Приветствие разработчика',
            type: 'task',
            content: `# Задача: Приветствие разработчика\n\nСчитайте имя через \`input()\` и выведите \`Привет, <имя>!\`.`,
            initialCode: `name = input()\n# Выведите приветствие:\n`,
            solution: `name = input().strip()\nprint(f"Привет, {name}!")`,
            tests: [
              { input: 'Кирилл', expected: 'Привет, Кирилл!' },
              { input: 'Анна', expected: 'Привет, Анна!' }
            ]
          }
        ]
      }
    ]
  }
];

export default function AdminPage() {
  const [courses, setCourses] = useState<Course[]>(DEFAULT_COURSES);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const SECRET_PIN = 'cisko_07'; // Придумай свой пароль или PIN-код
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string>('cpp-basics');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('cpp-mod-1');
  const [selectedItemId, setSelectedItemId] = useState<string>('cpp-1-theory');

  const [activeRightPanel, setActiveRightPanel] = useState<'course-settings' | 'item-editor'>('item-editor');
  const [newSkillText, setNewSkillText] = useState<string>('');

  // Статусы синхронизации с Supabase
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<string>('Загрузка из облака...');
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Загрузка курсов: сначала из Supabase, если база пустая — из localStorage или стандартные
  useEffect(() => {
    let isMounted = true;

    async function loadInitialCourses() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('data')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0 && isMounted) {
          const loadedCourses = data.map((row: { data: Course }) => row.data);
          setCourses(loadedCourses);
          setSelectedCourseId(loadedCourses[0].id);
          const firstMod = loadedCourses[0].modules[0];
          if (firstMod) {
            setSelectedModuleId(firstMod.id);
            if (firstMod.items[0]) setSelectedItemId(firstMod.items[0].id);
          }
          localStorage.setItem('dc_custom_courses', JSON.stringify(loadedCourses));
          setCloudStatus('Синхронизировано с Supabase ☁️');
          setIsHydrated(true);
          return;
        }
      } catch {
        // Fallback на локальное хранилище
      }

      if (!isMounted) return;
      try {
        const saved = localStorage.getItem('dc_custom_courses');
        if (saved) {
          const parsed: Course[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCourses(parsed);
            setSelectedCourseId(parsed[0].id);
          }
        }
        setCloudStatus('Локальный режим (нажмите «Опубликовать в облако»)');
      } catch {
        // Игнорируем ошибку
      } finally {
        setIsHydrated(true);
      }
    }

    loadInitialCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  // Локальный бэкап при каждом изменении
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem('dc_custom_courses', JSON.stringify(courses));
    } catch {
      // Игнорируем переполнение
    }
  }, [courses, isHydrated]);

  // Функция сохранения всех курсов в облако Supabase
  const handleSaveToSupabase = async () => {
    setIsSyncingCloud(true);
    setCloudError(null);

    try {
      const payload = courses.map((c) => ({
        id: c.id,
        title: c.title,
        language: c.language,
        data: c
      }));

      const { error } = await supabase.from('courses').upsert(payload, { onConflict: 'id' });

      if (error) {
        setCloudError(`Ошибка Supabase: ${error.message}`);
        setCloudStatus('Ошибка сохранения ❌');
      } else {
        setCloudStatus('Опубликовано в Supabase ✅');
      }
    } catch {
      setCloudError('Не удалось соединиться с сервером Supabase.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const currentCourse = useMemo<Course | undefined>(
    () => courses.find((c) => c.id === selectedCourseId) || courses[0],
    [courses, selectedCourseId]
  );

  const currentModule = useMemo<CourseModule | undefined>(
    () => currentCourse?.modules.find((m) => m.id === selectedModuleId) || currentCourse?.modules[0],
    [currentCourse, selectedModuleId]
  );

  const currentItem = useMemo<CourseItem | undefined>(
    () => currentModule?.items.find((i) => i.id === selectedItemId) || currentModule?.items[0],
    [currentModule, selectedItemId]
  );

  // --- ОПЕРАЦИИ С КУРСАМИ ---

  const handleAddCourse = () => {
    const newId = `course-${Date.now().toString().slice(-4)}`;
    const newModId = `mod-${Date.now().toString().slice(-4)}`;
    const newItemId = `item-${Date.now().toString().slice(-4)}`;

    const newCourse: Course = {
      id: newId,
      title: 'Новый курс программирования',
      language: 'C++',
      langKey: 'cpp',
      level: 'Начинающий',
      duration: '10 часов',
      accent: 'from-blue-600 to-cyan-500',
      badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      description: 'Описание нового образовательного курса.',
      skills: ['Базовый синтаксис', 'Решение задач'],
      modules: [
        {
          id: newModId,
          title: 'Модуль 1. Введение',
          items: [
            {
              id: newItemId,
              title: 'Первый урок',
              type: 'theory',
              content: '# Добро пожаловать на курс!\n\nНапишите здесь теоретический материал урока.'
            }
          ]
        }
      ]
    };

    setCourses((prev) => [...prev, newCourse]);
    setSelectedCourseId(newId);
    setSelectedModuleId(newModId);
    setSelectedItemId(newItemId);
    setActiveRightPanel('course-settings');
    setCloudStatus('Есть несохранённые в облаке изменения');
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (courses.length <= 1) return;
    const filtered = courses.filter((c) => c.id !== courseId);
    setCourses(filtered);
    setSelectedCourseId(filtered[0].id);
    setSelectedModuleId(filtered[0].modules[0]?.id || '');
    setSelectedItemId(filtered[0].modules[0]?.items[0]?.id || '');

    try {
      await supabase.from('courses').delete().eq('id', courseId);
      setCloudStatus('Курс удалён из облака 🗑️');
    } catch {
      // Игнорируем ошибку сети
    }
  };

  const updateCurrentCourse = (patch: Partial<Course>) => {
    if (!currentCourse) return;
    setCloudStatus('Есть несохранённые в облаке изменения');
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id !== currentCourse.id) return c;
        const updated = { ...c, ...patch };
        if (patch.language === 'C++') {
          updated.langKey = 'cpp';
          updated.accent = 'from-blue-600 to-cyan-500';
          updated.badgeBg = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
        } else if (patch.language === 'Python') {
          updated.langKey = 'python';
          updated.accent = 'from-amber-500 to-yellow-400';
          updated.badgeBg = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
        }
        return updated;
      })
    );
  };

  // --- ОПЕРАЦИИ С НАВЫКАМИ ---

  const handleAddSkill = () => {
    const trimmed = newSkillText.trim();
    if (!trimmed || !currentCourse) return;
    const existing = currentCourse.skills || [];
    if (!existing.includes(trimmed)) {
      updateCurrentCourse({ skills: [...existing, trimmed] });
    }
    setNewSkillText('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    if (!currentCourse) return;
    updateCurrentCourse({
      skills: (currentCourse.skills || []).filter((s) => s !== skillToRemove)
    });
  };

  // --- ОПЕРАЦИИ С МОДУЛЯМИ ---

  const handleAddModule = () => {
    if (!currentCourse) return;
    const modNum = currentCourse.modules.length + 1;
    const newModId = `mod-${Date.now().toString().slice(-5)}`;
    const newItemId = `item-${Date.now().toString().slice(-5)}`;

    const newMod: CourseModule = {
      id: newModId,
      title: `Модуль ${modNum}. Новая тема`,
      items: [
        {
          id: newItemId,
          title: 'Теоретическое введение',
          type: 'theory',
          content: '# Новая тема\n\nДобавьте описание теории и примеры кода.'
        }
      ]
    };

    updateCurrentCourse({ modules: [...currentCourse.modules, newMod] });
    setSelectedModuleId(newModId);
    setSelectedItemId(newItemId);
    setActiveRightPanel('item-editor');
  };

  const handleRenameModule = (modId: string, newTitle: string) => {
    if (!currentCourse) return;
    updateCurrentCourse({
      modules: currentCourse.modules.map((m) => (m.id === modId ? { ...m, title: newTitle } : m))
    });
  };

  const handleDeleteModule = (modId: string) => {
    if (!currentCourse || currentCourse.modules.length <= 1) return;
    const nextModules = currentCourse.modules.filter((m) => m.id !== modId);
    updateCurrentCourse({ modules: nextModules });
    setSelectedModuleId(nextModules[0].id);
    setSelectedItemId(nextModules[0].items[0]?.id || '');
  };

  // --- ОПЕРАЦИИ С УРОКАМИ И ЗАДАЧАМИ ---

  const handleAddItem = (modId: string, type: 'theory' | 'task') => {
    if (!currentCourse) return;
    const newItemId = `item-${Date.now().toString().slice(-5)}`;
    const isCpp = currentCourse.langKey === 'cpp';

    const newItem: CourseItem =
      type === 'theory'
        ? {
            id: newItemId,
            title: 'Новый урок (Теория)',
            type: 'theory',
            content: '# Заголовок урока\n\nТекст урока с поддержкой **Markdown** и блоков кода.'
          }
        : {
            id: newItemId,
            title: 'Новая задача (Практика)',
            type: 'task',
            content: '# Условие задачи\n\nОпишите, что должна делать программа и какие данные подаются на вход.',
            initialCode: isCpp
              ? `#include <iostream>\n\nint main() {\n    // Напишите ваш код здесь\n    return 0;\n}`
              : `# Напишите ваш код на Python здесь\n`,
            solution: isCpp
              ? `#include <iostream>\n\nint main() {\n    std::cout << "OK\\n";\n    return 0;\n}`
              : `print("OK")`,
            tests: [{ input: '1', expected: 'OK' }]
          };

    updateCurrentCourse({
      modules: currentCourse.modules.map((m) =>
        m.id === modId ? { ...m, items: [...m.items, newItem] } : m
      )
    });

    setSelectedModuleId(modId);
    setSelectedItemId(newItemId);
    setActiveRightPanel('item-editor');
  };

  const handleDeleteItem = (modId: string, itemId: string) => {
    if (!currentCourse) return;
    const targetMod = currentCourse.modules.find((m) => m.id === modId);
    if (!targetMod || targetMod.items.length <= 1) return;

    const updatedItems = targetMod.items.filter((i) => i.id !== itemId);
    updateCurrentCourse({
      modules: currentCourse.modules.map((m) => (m.id === modId ? { ...m, items: updatedItems } : m))
    });
    setSelectedItemId(updatedItems[0].id);
  };

  const updateCurrentItem = (patch: Partial<CourseItem>) => {
    if (!currentCourse || !currentModule || !currentItem) return;
    updateCurrentCourse({
      modules: currentCourse.modules.map((m) => {
        if (m.id !== currentModule.id) return m;
        return {
          ...m,
          items: m.items.map((item) => (item.id === currentItem.id ? { ...item, ...patch } : item))
        };
      })
    });
  };

  // --- ОПЕРАЦИИ С ТЕСТАМИ ---

  const handleAddTestCase = () => {
    if (!currentItem) return;
    const currentTests = currentItem.tests || [];
    updateCurrentItem({
      tests: [...currentTests, { input: '', expected: '' }]
    });
  };

  const handleUpdateTestCase = (idx: number, field: 'input' | 'expected', value: string) => {
    if (!currentItem) return;
    const currentTests = currentItem.tests || [];
    updateCurrentItem({
      tests: currentTests.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    });
  };

  const handleDeleteTestCase = (idx: number) => {
    if (!currentItem) return;
    const currentTests = currentItem.tests || [];
    if (currentTests.length <= 1) return;
    updateCurrentItem({
      tests: currentTests.filter((_, i) => i !== idx)
    });
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(courses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devcourses-db.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCourses(parsed);
          setSelectedCourseId(parsed[0].id);
          setCloudStatus('Импортировано! Нажмите «Опубликовать в облако»');
        }
      } catch {
        // Ошибка чтения JSON
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefaults = () => {
    localStorage.removeItem('dc_custom_courses');
    setCourses(DEFAULT_COURSES);
    setSelectedCourseId(DEFAULT_COURSES[0].id);
    setSelectedModuleId(DEFAULT_COURSES[0].modules[0].id);
    setSelectedItemId(DEFAULT_COURSES[0].modules[0].items[0].id);
    setCloudStatus('Сброшено к стандартным (нажмите «Опубликовать»)');
  };
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-sm w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
            <Settings className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Вход для администратора</h1>
          <p className="text-xs text-slate-400">
            Введите секретный PIN-код для доступа к управлению базой курсов Supabase
          </p>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pinInput === SECRET_PIN) setIsUnlocked(true);
            }}
            placeholder="Введите PIN-код..."
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-lg tracking-widest text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => {
              if (pinInput === SECRET_PIN) setIsUnlocked(true);
              else alert('Неверный пароль!');
            }}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer transition-colors"
          >
            Разблокировать студию
          </button>
          <Link href="/" className="block text-xs text-slate-500 hover:text-slate-300 pt-2">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Шапка админки */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs sm:text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>На главную</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base sm:text-lg text-white leading-none">
                  DevCourses Cloud Studio
                </h1>
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3 h-3" /> {cloudStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveToSupabase}
              disabled={isSyncingCloud}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
            >
              {isSyncingCloud ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CloudUpload className="w-4 h-4" />
              )}
              <span>
                {isSyncingCloud ? 'Сохранение в Supabase...' : 'Опубликовать в облако Supabase'}
              </span>
            </button>

            <button
              onClick={handleDownloadJson}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>JSON</span>
            </button>

            <label className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Импорт</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={handleResetToDefaults}
              className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сброс</span>
            </button>
          </div>
        </div>
      </header>

      {cloudError && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-4">
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{cloudError}</span>
          </div>
        </div>
      )}

      {/* Основная рабочая область */}
      <div className="flex-1 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
        <aside className="lg:col-span-4 space-y-5">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                1. Выберите курс
              </span>
              <button
                onClick={handleAddCourse}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Новый курс
              </button>
            </div>

            <div className="space-y-1.5">
              {courses.map((c) => {
                const isSelected = c.id === currentCourse?.id;
                return (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        const firstMod = c.modules[0];
                        if (firstMod) {
                          setSelectedModuleId(firstMod.id);
                          if (firstMod.items[0]) setSelectedItemId(firstMod.items[0].id);
                        }
                        setActiveRightPanel('course-settings');
                      }}
                      className="flex-1 text-left truncate text-sm font-semibold cursor-pointer"
                    >
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 mr-2">
                        {c.language}
                      </span>
                      {c.title}
                    </button>

                    {courses.length > 1 && (
                      <button
                        onClick={() => handleDeleteCourse(c.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setActiveRightPanel('course-settings')}
              className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                activeRightPanel === 'course-settings'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Настроить описание и навыки курса</span>
            </button>
          </div>

          {currentCourse && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-emerald-400" />
                  2. Модули и задачи курса
                </span>
                <button
                  onClick={handleAddModule}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Модуль
                </button>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {currentCourse.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => handleRenameModule(mod.id, e.target.value)}
                        className="flex-1 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 focus:border-blue-500 focus:outline-none text-xs font-bold text-white"
                      />
                      {currentCourse.modules.length > 1 && (
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1 pl-1">
                      {mod.items.map((item) => {
                        const isItemActive =
                          activeRightPanel === 'item-editor' && item.id === currentItem?.id;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isItemActive
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            <button
                              onClick={() => {
                                setSelectedModuleId(mod.id);
                                setSelectedItemId(item.id);
                                setActiveRightPanel('item-editor');
                              }}
                              className="flex-1 flex items-center gap-2 text-left truncate cursor-pointer"
                            >
                              {item.type === 'theory' ? (
                                <BookOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                              ) : (
                                <Terminal className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              )}
                              <span className="truncate">{item.title}</span>
                            </button>

                            {mod.items.length > 1 && (
                              <button
                                onClick={() => handleDeleteItem(mod.id, item.id)}
                                className="p-1 text-slate-600 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleAddItem(mod.id, 'theory')}
                        className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Теория
                      </button>
                      <button
                        onClick={() => handleAddItem(mod.id, 'task')}
                        className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Задача
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="lg:col-span-8">
          {activeRightPanel === 'course-settings' && currentCourse ? (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Настройки курса и навыков
                </span>
                <h2 className="text-2xl font-bold text-white mt-1">{currentCourse.title}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Название курса</label>
                  <input
                    type="text"
                    value={currentCourse.title}
                    onChange={(e) => updateCurrentCourse({ title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Язык компилятора</label>
                  <select
                    value={currentCourse.language}
                    onChange={(e) => updateCurrentCourse({ language: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="C++">C++ (GCC 10.2 / C++17)</option>
                    <option value="Python">Python (Python 3.10)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Уровень сложности</label>
                  <select
                    value={currentCourse.level}
                    onChange={(e) => updateCurrentCourse({ level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Начинающий">Начинающий</option>
                    <option value="Средний">Средний</option>
                    <option value="Продвинутый">Продвинутый</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Длительность курса</label>
                  <input
                    type="text"
                    value={currentCourse.duration}
                    onChange={(e) => updateCurrentCourse({ duration: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Краткое описание курса</label>
                <textarea
                  rows={3}
                  value={currentCourse.description}
                  onChange={(e) => updateCurrentCourse({ description: e.target.value })}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Навыки курса (Skills)
                </label>

                <div className="flex flex-wrap gap-2">
                  {(currentCourse.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30"
                    >
                      {skill}
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-rose-400 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillText}
                    onChange={(e) => setNewSkillText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Введите навык (например: ООП, std::vector)..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Добавить навык
                  </button>
                </div>
              </div>
            </div>
          ) : currentItem ? (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-slate-400">{currentModule?.title}</span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{currentItem.title}</h2>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => updateCurrentItem({ type: 'theory' })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      currentItem.type === 'theory'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Теория</span>
                  </button>
                  <button
                    onClick={() =>
                      updateCurrentItem({
                        type: 'task',
                        initialCode: currentItem.initialCode || '// Код по умолчанию\n',
                        solution: currentItem.solution || '// Решение\n',
                        tests: currentItem.tests?.length
                          ? currentItem.tests
                          : [{ input: '1', expected: '1' }]
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      currentItem.type === 'task'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Практическая задача</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Название шага</label>
                <input
                  type="text"
                  value={currentItem.title}
                  onChange={(e) => updateCurrentItem({ title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Контент (Markdown)
                </label>
                <textarea
                  rows={8}
                  value={currentItem.content}
                  onChange={(e) => updateCurrentItem({ content: e.target.value })}
                  className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-slate-100 leading-relaxed focus:border-blue-500 focus:outline-none"
                />
              </div>

              {currentItem.type === 'task' && (
                <div className="space-y-6 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                        <FileCode className="w-4 h-4" />
                        Стартовый шаблон кода (initialCode)
                      </label>
                      <textarea
                        rows={7}
                        value={currentItem.initialCode || ''}
                        onChange={(e) => updateCurrentItem({ initialCode: e.target.value })}
                        className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Эталонное решение (solution)
                      </label>
                      <textarea
                        rows={7}
                        value={currentItem.solution || ''}
                        onChange={(e) => updateCurrentItem({ solution: e.target.value })}
                        className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Автоматические тесты (Stdin → Stdout)
                        </h4>
                      </div>
                      <button
                        onClick={handleAddTestCase}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Добавить тест
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(currentItem.tests || []).map((test, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start"
                        >
                          <div className="sm:col-span-5 space-y-1">
                            <span className="text-[11px] font-mono text-slate-400">
                              Тест #{idx + 1} • Ввод (stdin):
                            </span>
                            <textarea
                              rows={2}
                              value={test.input}
                              onChange={(e) => handleUpdateTestCase(idx, 'input', e.target.value)}
                              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-6 space-y-1">
                            <span className="text-[11px] font-mono text-slate-400">
                              Ожидаемый вывод (stdout):
                            </span>
                            <textarea
                              rows={2}
                              value={test.expected}
                              onChange={(e) =>
                                handleUpdateTestCase(idx, 'expected', e.target.value)
                              }
                              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 focus:border-emerald-500 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end sm:pt-6">
                            {(currentItem.tests?.length || 0) > 1 && (
                              <button
                                onClick={() => handleDeleteTestCase(idx)}
                                className="p-2 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}