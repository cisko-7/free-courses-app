// Supabase Edge Function (Deno): прокси запуска кода к вашему Piston.
// Путь в проекте: supabase/functions/run-code/index.ts
// Деплой:  supabase functions deploy run-code
// Секреты: supabase secrets set PISTON_URL=https://ваш-piston/api/v2/execute ALLOWED_ORIGIN=https://ваш-сайт
// Адрес для сайта: NEXT_PUBLIC_RUN_URL=https://<project-ref>.supabase.co/functions/v1/run-code

const MAX_CODE = 30_000;
const MAX_STDIN = 5_000;
const MAX_OUT = 10_000;
const LANGUAGES: Record<string, string> = { cpp: "c++", python: "python" };

const allowed = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": allowed,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clip = (s: unknown) => String(s ?? "").slice(0, MAX_OUT);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const origin = req.headers.get("origin");
  if (!allowed || origin !== allowed) return json({ error: "forbidden" }, 403);

  const pistonUrl = Deno.env.get("PISTON_URL");
  if (!pistonUrl) return json({ error: "not_configured" }, 503);

  let body: { language?: string; code?: unknown; stdin?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const language = LANGUAGES[body.language ?? ""];
  if (!language || typeof body.code !== "string") return json({ error: "bad_request" }, 400);
  const stdin = typeof body.stdin === "string" ? body.stdin : "";
  if (body.code.length > MAX_CODE || stdin.length > MAX_STDIN) return json({ error: "too_long" }, 413);

  try {
    const apiKey = Deno.env.get("PISTON_API_KEY");
    const res = await fetch(pistonUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: apiKey } : {}) },
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ content: body.code }],
        stdin,
        compile_timeout: 10_000,
        run_timeout: 5_000,
        run_memory_limit: 256_000_000,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return json({ error: "upstream_error" }, 502);
    const data = await res.json();
    if (data?.compile && data.compile.code !== 0) {
      return json({ stdout: "", stderr: clip(data.compile.stderr || data.compile.output || "Ошибка компиляции") });
    }
    if (!data?.run) return json({ error: "upstream_error" }, 502);
    return json({ stdout: clip(data.run.stdout), stderr: clip(data.run.stderr) });
  } catch {
    return json({ error: "upstream_unavailable" }, 502);
  }
});
