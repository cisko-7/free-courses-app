"use client";

import { useState, useMemo, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Menu,
  X,
  BookOpen,
  Terminal,
  Code2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Trophy,
  Award,
  Sparkles,
  Check,
  Copy,
  Layers,
} from "lucide-react";
import { type Course, getAllCourseItems } from "@/lib/data";
import { useProgress } from "@/hooks/useProgress";
import CodeEditorWorkspace from "@/components/CodeEditorWorkspace";

interface CourseViewerProps {
  course: Course;
}

function CourseViewerContent({ course }: CourseViewerProps) {
  const searchParams = useSearchParams();
  const { completedLessons, markLessonComplete, enrollInCourse } = useProgress();

  // Ensure course is enrolled when viewing
  useEffect(() => {
    enrollInCourse(course.id);
  }, [course.id, enrollInCourse]);

  // Flatten all items across all topics
  const allItems = useMemo(() => getAllCourseItems(course), [course]);

  // Initial lesson from URL search param or first item
  const paramLessonId = searchParams.get("lesson");
  const initialLesson = useMemo(() => {
    if (paramLessonId) {
      const found = allItems.find((item) => item.id === paramLessonId);
      if (found) return found;
    }
    return allItems[0] || null;
  }, [allItems, paramLessonId]);

  const [activeItemId, setActiveItemId] = useState<string>(
    initialLesson?.id || allItems[0]?.id || ""
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [copiedSolution, setCopiedSolution] = useState(false);

  // Accordion state for topics: open by default
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    course.topics.forEach((t) => {
      initial[t.id] = true;
    });
    return initial;
  });

  // Current active item object
  const currentItem =
    allItems.find((item) => item.id === activeItemId) || allItems[0];

  const currentIndex = allItems.findIndex((item) => item.id === currentItem?.id);
  const nextItem =
    currentIndex >= 0 && currentIndex < allItems.length - 1
      ? allItems[currentIndex + 1]
      : null;
  const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;

  const isCurrentCompleted = currentItem
    ? completedLessons.includes(currentItem.id)
    : false;

  // Auto-expand topic containing current item
  useEffect(() => {
    if (currentItem?.topicId) {
      setExpandedTopics((prev) => ({
        ...prev,
        [currentItem.topicId]: true,
      }));
    }
    setSolutionOpen(false);
    setCopiedSolution(false);
  }, [currentItem?.id, currentItem?.topicId]);

  // Toggle topic accordion
  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  // Switch lesson handler
  const handleSelectLesson = (itemId: string) => {
    setActiveItemId(itemId);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("lesson", itemId);
    window.history.pushState({}, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Complete lesson & proceed
  const handleCompleteAndNext = () => {
    if (currentItem) {
      markLessonComplete(currentItem.id);
    }
    if (nextItem) {
      handleSelectLesson(nextItem.id);
    }
  };

  // Copy solution code
  const handleCopySolution = () => {
    if (currentItem?.solution) {
      navigator.clipboard.writeText(currentItem.solution);
      setCopiedSolution(true);
      setTimeout(() => setCopiedSolution(false), 2000);
    }
  };

  // Progress metrics
  const completedCount = allItems.filter((item) =>
    completedLessons.includes(item.id)
  ).length;
  const progressPercent = Math.round((completedCount / allItems.length) * 100);
  const isCourseFullyCompleted =
    allItems.length > 0 && completedCount === allItems.length;

  const isTask = currentItem?.type === "task";

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-950 text-slate-200 min-h-[calc(100vh-4rem)]">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-16 z-30">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium"
        >
          {mobileMenuOpen ? (
            <X className="w-4 h-4 text-slate-400" />
          ) : (
            <Menu className="w-4 h-4 text-slate-400" />
          )}
          <span>
            Уроки ({currentIndex + 1}/{allItems.length})
          </span>
        </button>

        <span className="text-xs text-slate-400 truncate max-w-[180px]">
          {course.title}
        </span>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-16 z-40 md:z-20 w-80 max-w-[85vw] shrink-0 h-[calc(100vh-4rem)] bg-slate-900/95 md:bg-slate-900/60 border-r border-slate-800 flex flex-col transition-transform duration-300 backdrop-blur-md ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-3 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>Каталог курсов</span>
          </Link>

          <h2 className="text-base font-bold text-white tracking-tight leading-snug line-clamp-2 mb-2">
            {course.title}
          </h2>

          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Прогресс курса</span>
            <span className="font-semibold text-blue-400">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Scrollable Topics Accordion */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
          {course.topics.map((topic) => {
            const isExpanded = !!expandedTopics[topic.id];
            const topicCompletedCount = topic.items.filter((item) =>
              completedLessons.includes(item.id)
            ).length;
            const isTopicCompleted =
              topicCompletedCount === topic.items.length && topic.items.length > 0;

            return (
              <div
                key={topic.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden"
              >
                <button
                  onClick={() => toggleTopic(topic.id)}
                  className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-white tracking-tight truncate">
                      {topic.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">
                      {topicCompletedCount}/{topic.items.length}
                    </span>
                    {isTopicCompleted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-1 pt-0 space-y-1 border-t border-slate-800/40 bg-slate-900/30">
                    {topic.items.map((item) => {
                      const isActive = item.id === currentItem?.id;
                      const isCompleted = completedLessons.includes(item.id);

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectLesson(item.id)}
                          className={`w-full text-left p-2 rounded-lg flex items-center justify-between gap-2 transition-all duration-150 ${
                            isActive
                              ? "bg-blue-600/15 border border-blue-500/30 text-white shadow-sm"
                              : "hover:bg-slate-800/60 border border-transparent text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="shrink-0">
                              {item.type === "theory" ? (
                                <BookOpen
                                  className={`w-3.5 h-3.5 ${
                                    isActive ? "text-blue-400" : "text-slate-400"
                                  }`}
                                />
                              ) : (
                                <Terminal
                                  className={`w-3.5 h-3.5 ${
                                    isActive ? "text-amber-400" : "text-amber-500/70"
                                  }`}
                                />
                              )}
                            </div>

                            <span
                              className={`text-xs leading-snug truncate ${
                                isActive ? "font-semibold text-white" : "font-normal"
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>

                          <div className="shrink-0 pl-1">
                            {isCompleted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Circle
                                className={`w-3 h-3 ${
                                  isActive ? "text-blue-400" : "text-slate-700"
                                }`}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <span>{course.language} • {course.level}</span>
          <span className="font-mono text-blue-400">
            {completedCount}/{allItems.length}
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {currentItem ? (
          isTask ? (
            /* ============================================================ */
            /* SPLIT-SCREEN LAYOUT FOR PRACTICAL CODING TASKS (LeetCode style) */
            /* ============================================================ */
            <div className="flex-1 flex flex-col lg:flex-row h-full">
              {/* Left Column: Task Description & Reference Solution */}
              <div className="w-full lg:w-1/2 p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto max-h-none lg:max-h-[calc(100vh-4rem)]">
                {/* Header Badge */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Интерактивная задача</span>
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
                    Шаг {currentIndex + 1} из {allItems.length}
                  </span>

                  {isCurrentCompleted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Выполнено</span>
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-4">
                  {currentItem.title}
                </h1>

                {/* Markdown Task Content */}
                <div className="prose-content text-slate-300 leading-relaxed space-y-4 mb-8">
                  <Markdown
                    components={{
                      h1: ({ children }) => (
                        <h2 className="text-xl font-bold text-white mt-6 mb-3 border-b border-slate-800 pb-1.5">
                          {children}
                        </h2>
                      ),
                      h2: ({ children }) => (
                        <h3 className="text-lg font-bold text-white mt-5 mb-2">
                          {children}
                        </h3>
                      ),
                      h3: ({ children }) => (
                        <h4 className="text-base font-semibold text-slate-100 mt-4 mb-1.5">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-slate-300 text-sm leading-relaxed mb-3">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-slate-300">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-slate-300">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-slate-300 text-sm">{children}</li>
                      ),
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isMultiline = String(children).includes("\n");

                        if (!match && !isMultiline) {
                          return (
                            <code
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-xs border border-slate-700"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }

                        const lang = match ? match[1] : "text";
                        return (
                          <div className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e]">
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={lang}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                padding: "0.85rem",
                                background: "transparent",
                                fontSize: "0.825rem",
                                lineHeight: "1.5",
                              }}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          </div>
                        );
                      },
                    }}
                  >
                    {currentItem.content}
                  </Markdown>
                </div>

                {/* Reference Solution Spoiler */}
                {currentItem.solution && (
                  <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 overflow-hidden mb-6">
                    <div className="p-3 bg-amber-500/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-200">
                          Эталонное решение
                        </span>
                      </div>
                      <button
                        onClick={() => setSolutionOpen(!solutionOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-colors"
                      >
                        {solutionOpen ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Скрыть</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Показать</span>
                          </>
                        )}
                      </button>
                    </div>

                    {solutionOpen && (
                      <div className="p-3 bg-[#1e1e1e] border-t border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            {course.language}
                          </span>
                          <button
                            onClick={handleCopySolution}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            {copiedSolution ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Копировать</span>
                              </>
                            )}
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={course.language.toLowerCase().includes("python") ? "python" : "cpp"}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            padding: "0.75rem",
                            background: "transparent",
                            fontSize: "0.8rem",
                          }}
                        >
                          {currentItem.solution}
                        </SyntaxHighlighter>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom navigation link for previous lesson */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  {prevItem ? (
                    <button
                      onClick={() => handleSelectLesson(prevItem.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{prevItem.title}</span>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {/* Right Column: Monaco Code Editor & Live Test Terminal */}
              <div className="w-full lg:w-1/2 p-3 sm:p-4 lg:p-6 flex flex-col h-auto lg:h-[calc(100vh-4rem)]">
                <CodeEditorWorkspace
                  item={currentItem}
                  courseLanguage={course.language}
                  isCompleted={isCurrentCompleted}
                  onComplete={() => markLessonComplete(currentItem.id)}
                  onNext={handleCompleteAndNext}
                  hasNext={!!nextItem}
                />
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* STANDARD READING LAYOUT FOR THEORY LESSONS                   */
            /* ============================================================ */
            <article className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-8 lg:px-12 py-8 md:py-12">
              <div className="pb-6 mb-8 border-b border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {currentItem.topicTitle}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>Теоретический урок</span>
                  </span>

                  <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700">
                    Шаг {currentIndex + 1} из {allItems.length}
                  </span>

                  {isCurrentCompleted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Выполнено</span>
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {currentItem.title}
                </h1>
              </div>

              {/* Theory Markdown */}
              <div className="prose-content flex-1 text-slate-300 leading-relaxed space-y-4">
                <Markdown
                  components={{
                    h1: ({ children }) => (
                      <h2 className="text-2xl font-bold text-white mt-8 mb-4 border-b border-slate-800 pb-2">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h3 className="text-xl font-bold text-white mt-6 mb-3">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="text-lg font-semibold text-slate-100 mt-5 mb-2">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-slate-300 text-base leading-relaxed mb-4">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1.5 mb-4 text-slate-300">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1.5 mb-4 text-slate-300">
                        {children}
                      </ol>
                    ),
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isMultiline = String(children).includes("\n");

                      if (!match && !isMultiline) {
                        return (
                          <code
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-sm border border-slate-700"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      const lang = match ? match[1] : "text";

                      return (
                        <div className="my-6 rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e] shadow-xl">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800/80 text-xs text-slate-400 font-mono">
                            <span className="uppercase tracking-wider font-semibold text-blue-400">
                              {lang}
                            </span>
                            <span className="text-slate-400 text-[11px]">Пример кода</span>
                          </div>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={lang}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              padding: "1.25rem",
                              background: "transparent",
                              fontSize: "0.875rem",
                              lineHeight: "1.6",
                            }}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                  }}
                >
                  {currentItem.content}
                </Markdown>
              </div>

              {/* Course Fully Completed Banner */}
              {isCourseFullyCompleted && (
                <div className="mt-8 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        Поздравляем! Вы завершили все уроки курса! 🎉
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300">
                        Все теоретические уроки и практические задачи пройдены.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/"
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Вернуться на главную</span>
                  </Link>
                </div>
              )}

              {/* Bottom Navigation */}
              <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                {prevItem ? (
                  <button
                    onClick={() => handleSelectLesson(prevItem.id)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all duration-150"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Предыдущий урок</span>
                  </button>
                ) : (
                  <div className="hidden sm:block" />
                )}

                <button
                  onClick={handleCompleteAndNext}
                  id="complete-lesson-button"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm sm:text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 transition-all duration-200 active:scale-[0.98]"
                >
                  {nextItem ? (
                    <>
                      <span>
                        {currentItem.topicId !== nextItem.topicId
                          ? "Завершить и перейти к следующей теме →"
                          : "Завершить урок и перейти дальше"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 text-yellow-300" />
                      <span>Завершить урок (Курс завершен! 🎓)</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          )
        ) : (
          <div className="py-20 text-center">
            <p className="text-slate-400">Уроки в этом курсе еще не добавлены.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CourseViewer({ course }: CourseViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <CourseViewerContent course={course} />
    </Suspense>
  );
}
