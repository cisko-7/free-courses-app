"use client";

import { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  FileCode2,
  ListFilter,
  ArrowRight,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import { type CourseItem } from "@/lib/data";
import { safeGet, safeSet } from "@/lib/safe-storage";
import { runTestCases, type TestSuiteResult, type SingleTestResult } from "@/lib/executor";

interface CodeEditorWorkspaceProps {
  item: CourseItem;
  courseLanguage: string;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
  hasNext: boolean;
}

export default function CodeEditorWorkspace({
  item,
  courseLanguage,
  isCompleted,
  onComplete,
  onNext,
  hasNext,
}: CodeEditorWorkspaceProps) {
  const language = courseLanguage.toLowerCase().includes("python")
    ? "python"
    : "cpp";

  const storageKey = `devcourses_code_${item.id}`;
  // Ограничение размера решения: защищает localStorage и сервер проверки
  const MAX_CODE_LENGTH = 30000;

  // Initialize code from localStorage or item.initialCode
  const [code, setCode] = useState<string>(() => {
    const saved = safeGet(storageKey);
    if (saved) return saved;
    return item.initialCode || "";
  });

  const [isRunning, setIsRunning] = useState(false);
  const [testSuiteResult, setTestSuiteResult] = useState<TestSuiteResult | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "testcases" | "console">("results");
  const [selectedTestIdx, setSelectedTestIdx] = useState(0);

  // Synchronize when switching to a different task
  useEffect(() => {
    setCode(safeGet(storageKey) || item.initialCode || "");
    setTestSuiteResult(null);
    setSelectedTestIdx(0);
    setActiveTab("results");
  }, [item.id, item.initialCode, storageKey]);

  // Save code changes to LocalStorage
  const handleCodeChange = (newVal?: string) => {
    const val = (newVal ?? "").slice(0, MAX_CODE_LENGTH);
    setCode(val);
    safeSet(storageKey, val);
  };

  // Reset code to default initialCode template
  const handleReset = () => {
    if (window.confirm("Сбросить код до исходного шаблона? Ваши текущие изменения будут стёрты.")) {
      const initial = item.initialCode || "";
      setCode(initial);
      safeSet(storageKey, initial);
      setTestSuiteResult(null);
    }
  };

  // Run test cases against user code
  const handleRunTests = useCallback(async () => {
    if (!item.tests || item.tests.length === 0) return;
    setIsRunning(true);
    setActiveTab("results");

    try {
      const result = await runTestCases(language, code, item.tests);
      setTestSuiteResult(result);

      if (result.success) {
        onComplete();
      }
    } catch (err: unknown) {
      setTestSuiteResult({
        success: false,
        total: item.tests.length,
        passedCount: 0,
        results: [],
        error: err instanceof Error && err.message ? err.message : "Ошибка при выполнении тестов",
      });
    } finally {
      setIsRunning(false);
    }
  }, [code, item.tests, language, onComplete]);

  // Keyboard shortcut: Ctrl + Enter to run tests
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning) {
          handleRunTests();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunTests, isRunning]);

  const activeTestResult: SingleTestResult | undefined =
    testSuiteResult?.results?.[selectedTestIdx];

  const currentTestCase = item.tests?.[selectedTestIdx];

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Editor Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700/80 font-mono text-blue-400 font-semibold">
            <FileCode2 className="w-3.5 h-3.5" />
            <span>{language === "python" ? "solution.py" : "solution.cpp"}</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {courseLanguage}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="Сбросить код до исходного шаблона"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сбросить</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 min-h-[350px] relative">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-dark"
          onChange={handleCodeChange}
          options={{
            fontSize: 14,
            fontFamily: "var(--font-mono, 'Fira Code', 'JetBrains Mono', Consolas, monospace)",
            lineNumbers: "on",
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            minimap: { enabled: false },
            automaticLayout: true,
            tabSize: 4,
            wordWrap: "on",
            cursorBlinking: "smooth",
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            padding: { top: 12, bottom: 12 },
          }}
          loading={
            <div className="h-full flex items-center justify-center bg-slate-950 text-slate-400">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-sm">Загрузка редактора кода...</span>
              </div>
            </div>
          }
        />
      </div>

      {/* Terminal & Test Execution Panel */}
      <div className="border-t border-slate-800 bg-slate-900/95 flex flex-col min-h-[220px] max-h-[300px]">
        {/* Terminal Header & Navigation */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-950/60 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("results")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "results"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Результаты тестов</span>
              {testSuiteResult && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    testSuiteResult.success
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {testSuiteResult.passedCount}/{testSuiteResult.total}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("testcases")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "testcases"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5 text-amber-400" />
              <span>Тестовые кейсы</span>
              <span className="ml-1 text-[10px] font-mono text-slate-500">
                ({item.tests?.length || 0})
              </span>
            </button>

            <button
              onClick={() => setActiveTab("console")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "console"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>Консоль</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden md:inline">
              Ctrl + Enter
            </span>

            {testSuiteResult?.success ? (
              <button
                onClick={hasNext ? onNext : () => {}}
                id="next-lesson-solved-button"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition-all duration-200 animate-pulse"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Задача решена (Далее)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleRunTests}
                disabled={isRunning}
                id="run-tests-button"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 shadow-md shadow-blue-600/25 transition-all duration-150 active:scale-95"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Тестирование...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Запустить тесты</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body Content */}
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-slate-300">
          {/* TAB 1: RESULTS */}
          {activeTab === "results" && (
            <div>
              {!testSuiteResult && !isRunning && (
                <div className="h-full py-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <Terminal className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
                  <p className="text-xs">Нажмите «Запустить тесты», чтобы проверить решение.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Код будет скомпилирован и проверен на {item.tests?.length || 0} тестовых случаях.
                  </p>
                </div>
              )}

              {isRunning && (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin mb-3" />
                  <p className="text-xs text-slate-300 font-semibold">Компиляция и прогон тестов...</p>
                  <p className="text-[11px] text-slate-400 mt-1">Отправка в защищенную песочницу выполнения</p>
                </div>
              )}

              {testSuiteResult && !isRunning && (
                <div>
                  {/* Status Banner */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between mb-3 ${
                      testSuiteResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testSuiteResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span className="font-semibold text-xs">
                        {testSuiteResult.success
                          ? "Все тесты успешно пройдены! 🚀 Решение верное."
                          : `Тестирование не пройдено: ${testSuiteResult.passedCount} из ${testSuiteResult.total} тестов завершились успехом.`}
                      </span>
                    </div>

                    {testSuiteResult.success && (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-sans">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Прогресс сохранён</span>
                      </div>
                    )}
                  </div>

                  {/* Compilation Error notice if any */}
                  {testSuiteResult.compileError && (
                    <div className="p-3 mb-3 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300">
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Ошибка компиляции:</span>
                      </div>
                      <pre className="text-[11px] whitespace-pre-wrap font-mono text-red-200/90 leading-relaxed overflow-x-auto">
                        {testSuiteResult.compileError}
                      </pre>
                    </div>
                  )}

                  {/* Test selector tabs */}
                  {testSuiteResult.results.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                        {testSuiteResult.results.map((res, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedTestIdx(idx)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all text-xs ${
                              selectedTestIdx === idx
                                ? res.passed
                                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 font-bold"
                                  : "bg-red-500/20 border-red-500/50 text-red-200 font-bold"
                                : res.passed
                                ? "bg-slate-800/60 border-slate-700/60 text-emerald-400 hover:bg-slate-800"
                                : "bg-slate-800/60 border-slate-700/60 text-red-400 hover:bg-slate-800"
                            }`}
                          >
                            {res.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <span>Тест {res.testIndex}</span>
                            {res.executionTime !== undefined && (
                              <span className="text-[10px] text-slate-400">
                                {res.executionTime}ms
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Detail of active test */}
                      {activeTestResult && (
                        <div className="space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                          <div>
                            <div className="text-[11px] text-slate-400 mb-1 font-semibold uppercase">
                              Входные данные (stdin):
                            </div>
                            <pre className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 whitespace-pre-wrap">
                              {activeTestResult.input || "<пусто>"}
                            </pre>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] text-emerald-400 mb-1 font-semibold uppercase">
                                Ожидаемый вывод:
                              </div>
                              <pre className="p-2 rounded-lg bg-slate-900 border border-emerald-900/40 text-emerald-200 whitespace-pre-wrap">
                                {activeTestResult.expected}
                              </pre>
                            </div>

                            <div>
                              <div
                                className={`text-[11px] mb-1 font-semibold uppercase ${
                                  activeTestResult.passed ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                Вывод вашей программы:
                              </div>
                              <pre
                                className={`p-2 rounded-lg bg-slate-900 border whitespace-pre-wrap ${
                                  activeTestResult.passed
                                    ? "border-emerald-900/40 text-emerald-200"
                                    : "border-red-900/40 text-red-200"
                                }`}
                              >
                                {activeTestResult.actual || "<нет вывода>"}
                              </pre>
                            </div>
                          </div>

                          {!activeTestResult.passed && activeTestResult.stderr && (
                            <div>
                              <div className="text-[11px] text-red-400 mb-1 font-semibold uppercase">
                                Ошибка выполнения (stderr):
                              </div>
                              <pre className="p-2 rounded-lg bg-red-950/30 border border-red-900/50 text-red-200 whitespace-pre-wrap">
                                {activeTestResult.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEST CASES (Inspect all test cases beforehand) */}
          {activeTab === "testcases" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {item.tests?.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTestIdx(idx)}
                    className={`px-3 py-1 rounded-lg border text-xs transition-colors ${
                      selectedTestIdx === idx
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300 font-bold"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Тест {idx + 1}
                  </button>
                ))}
              </div>

              {currentTestCase && (
                <div className="space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1 font-semibold">
                      Входной поток (stdin):
                    </div>
                    <pre className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 whitespace-pre-wrap">
                      {currentTestCase.input}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 mb-1 font-semibold">
                      Ожидаемый вывод программы (stdout):
                    </div>
                    <pre className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 whitespace-pre-wrap">
                      {currentTestCase.expected}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW CONSOLE OUTPUT */}
          {activeTab === "console" && (
            <div>
              {testSuiteResult ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Сводный лог выполнения:</span>
                    <span>Пройдено {testSuiteResult.passedCount} из {testSuiteResult.total}</span>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {testSuiteResult.results
                      .map(
                        (r) =>
                          `[Тест ${r.testIndex}]: ${r.passed ? "PASSED (Успех)" : "FAILED (Ошибка)"}\nВвод: ${r.input.trim()}\nОжидалось:\n${r.expected.trim()}\nПолучено:\n${(r.actual || "").trim()}\n${r.stderr ? "Stderr: " + r.stderr + "\n" : ""}`
                      )
                      .join("\n----------------------------------------\n")}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Консоль пуста. Запустите тесты для отображения вывода.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
