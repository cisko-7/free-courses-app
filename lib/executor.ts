export interface TestCase {
  input: string;
  expected: string;
}

export interface SingleTestResult {
  testIndex: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  stderr?: string;
  compileError?: string;
  executionTime?: number;
}

export interface ExecutionRunResult {
  stdout: string;
  stderr: string;
  compileError?: string;
  exitCode: number;
  durationMs: number;
  runner: "piston" | "wandbox" | "mock";
}

export interface TestSuiteResult {
  success: boolean;
  total: number;
  passedCount: number;
  results: SingleTestResult[];
  rawOutput?: string;
  compileError?: string;
  error?: string;
}

// Normalize output for accurate comparison (normalize CRLF and trim whitespace)
export function normalizeOutput(str: string): string {
  return str
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

// Map language to Piston & Wandbox language identifiers
function mapLanguage(lang: string) {
  const normalized = lang.toLowerCase().trim();
  if (normalized.includes("python") || normalized === "py") {
    return {
      piston: "python",
      pistonFile: "main.py",
      wandboxCompiler: "cpython-3.12.7",
      langName: "Python",
    };
  }
  return {
    piston: "cpp",
    pistonFile: "main.cpp",
    wandboxCompiler: "gcc-head",
    langName: "C++",
  };
}

/**
 * Execute code on Piston API instance
 */
async function executeOnPiston(
  pistonUrl: string,
  pistonLang: string,
  fileName: string,
  code: string,
  stdin: string
): Promise<ExecutionRunResult | null> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(pistonUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        language: pistonLang,
        version: "*",
        files: [
          {
            name: fileName,
            content: code,
          },
        ],
        stdin: stdin,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    // Check if instance returned whitelist notice or error message
    if (data.message && data.message.includes("whitelist")) {
      return null;
    }

    const compile = data.compile || {};
    const run = data.run || {};

    const compileError = compile.stderr || compile.output || "";
    const isCompileFailed = compile.code && compile.code !== 0;

    if (isCompileFailed) {
      return {
        stdout: "",
        stderr: compileError,
        compileError: compileError,
        exitCode: compile.code || 1,
        durationMs: Date.now() - startTime,
        runner: "piston",
      };
    }

    return {
      stdout: run.stdout || run.output || "",
      stderr: run.stderr || "",
      exitCode: run.code ?? 0,
      durationMs: Date.now() - startTime,
      runner: "piston",
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Execute code on Wandbox API (high reliability fallback for public GCC / Python execution)
 */
async function executeOnWandbox(
  compiler: string,
  code: string,
  stdin: string
): Promise<ExecutionRunResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("https://wandbox.org/api/compile.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        stdin: stdin,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Wandbox execution failed with HTTP status ${res.status}`);
    }

    const data = await res.json();
    const compileError = data.compiler_error || data.compiler_message || "";
    const isCompileError = data.status !== "0" && compileError.length > 0;

    return {
      stdout: data.program_output || "",
      stderr: data.program_error || (isCompileError ? compileError : ""),
      compileError: isCompileError ? compileError : undefined,
      exitCode: parseInt(data.status, 10) || 0,
      durationMs: Date.now() - startTime,
      runner: "wandbox",
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw new Error(error.message || "Failed to execute code in sandbox");
  }
}

/**
 * Universal code executor: tries Piston instances first, falls back to Wandbox
 */
export async function executeCode(
  language: string,
  code: string,
  stdin: string = ""
): Promise<ExecutionRunResult> {
  const langConfig = mapLanguage(language);

  // 1. Try Piston endpoints (emacs.ch or public instances)
  const pistonEndpoints = [
    "https://emacs.ch/api/v2/execute",
    "https://emkc.org/api/v2/piston/execute",
  ];

  for (const endpoint of pistonEndpoints) {
    const result = await executeOnPiston(
      endpoint,
      langConfig.piston,
      langConfig.pistonFile,
      code,
      stdin
    );
    if (result) {
      return result;
    }
  }

  // 2. Reliable open runner: Wandbox
  return await executeOnWandbox(langConfig.wandboxCompiler, code, stdin);
}

/**
 * Run all test cases sequentially against the user's code
 */
export async function runTestCases(
  language: string,
  code: string,
  tests: TestCase[]
): Promise<TestSuiteResult> {
  if (!tests || tests.length === 0) {
    return {
      success: true,
      total: 0,
      passedCount: 0,
      results: [],
    };
  }

  const results: SingleTestResult[] = [];
  let compileError: string | undefined = undefined;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    try {
      const execResult = await executeCode(language, code, test.input);

      if (execResult.compileError) {
        compileError = execResult.compileError;
      }

      const normalizedActual = normalizeOutput(execResult.stdout);
      const normalizedExpected = normalizeOutput(test.expected);
      const passed =
        normalizedActual === normalizedExpected &&
        execResult.exitCode === 0 &&
        !execResult.compileError;

      results.push({
        testIndex: i + 1,
        input: test.input,
        expected: test.expected,
        actual: execResult.stdout,
        passed,
        stderr: execResult.stderr,
        compileError: execResult.compileError,
        executionTime: execResult.durationMs,
      });

      // If compilation failed on first test, no need to run subsequent tests with same compile error
      if (execResult.compileError && i === 0) {
        for (let j = 1; j < tests.length; j++) {
          results.push({
            testIndex: j + 1,
            input: tests[j].input,
            expected: tests[j].expected,
            actual: "",
            passed: false,
            compileError: execResult.compileError,
            stderr: "Ошибка компиляции программы",
          });
        }
        break;
      }
    } catch (err: any) {
      results.push({
        testIndex: i + 1,
        input: test.input,
        expected: test.expected,
        actual: "",
        passed: false,
        stderr: err?.message || "Неизвестная ошибка выполнения",
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const success = passedCount === tests.length && tests.length > 0;

  return {
    success,
    total: tests.length,
    passedCount,
    results,
    compileError,
  };
}
