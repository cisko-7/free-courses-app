/**
 * DevCourses AI Autopilot: управление сайтом через Google Gemini REST API.
 * Поддерживает как текстовые ответы, так и структурированные JSON-команды.
 */

export type AIActionType =
  | 'TOGGLE_MAINTENANCE'
  | 'UPDATE_BANNER'
  | 'TOGGLE_REGISTRATION'
  | 'GRANT_XP'
  | 'BAN_USER'
  | 'UNBAN_USER'
  | 'CREATE_CUSTOM_TASK'
  | 'DIAGNOSE_SYSTEM'
  | 'HEAL_DATA'
  | 'NONE';

export interface AIAction {
  type: AIActionType;
  params: Record<string, unknown>;
  description: string;
}

export interface AIResponse {
  text: string;
  action?: AIAction;
  timestamp: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Получить API-ключ Gemini:
 * 1. Сначала проверяем env (NEXT_PUBLIC_GEMINI_API_KEY)
 * 2. Если нет, берём из защищённого хранилища админки (localStorage с префиксом)
 */
export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || localStorage.getItem('_dc_gemini_key') || null;
}

/** Сохранить API-ключ в защищённое хранилище (админка) */
export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('_dc_gemini_key', key);
  }
}

/**
 * Отправить запрос в Gemini и получить структурированный ответ.
 */
export async function callGeminiAPI(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: AIMessage[] = []
): Promise<AIResponse> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Ключ Google Gemini API не настроен.');
  }

  const messages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  messages.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json() as Record<string, unknown>;
      throw new Error(`Gemini API: ${(error.error as Record<string, unknown>)?.message || response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    const text = (parts?.[0]?.text as string) || '';

    if (!text) {
      throw new Error('Пустой ответ от Gemini API');
    }

    const actionMatch = text.match(/\[AI_ACTION:\s*(\{[\s\S]*?\})\s*\]/);
    let action: AIAction | undefined;
    let displayText = text;

    if (actionMatch) {
      try {
        const actionObj = JSON.parse(actionMatch[1]) as Record<string, unknown>;
        action = {
          type: (actionObj.type as AIActionType) || 'NONE',
          params: (actionObj.params as Record<string, unknown>) || {},
          description: (actionObj.description as string) || ''
        };
        displayText = text.replace(actionMatch[0], '').trim();
      } catch {
        // Игнорируем
      }
    }

    return { text: displayText, action, timestamp: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    throw new Error(`Ошибка Gemini API: ${message}`);
  }
}

export const ADMIN_COMMANDER_PROMPT = `Ты – AI-ассистент админ-панели DevCourses.
Конвертируй команды администратора в действия. Ответы на русском.

ДЕЙСТВИЯ:
1. TOGGLE_MAINTENANCE: { maintenance: boolean, message?: string }
2. UPDATE_BANNER: { enabled: boolean, text?: string, tone?: 'info'|'success'|'warning'|'danger' }
3. TOGGLE_REGISTRATION: { open: boolean }
4. GRANT_XP: { email: string, amount: number }
5. BAN_USER: { email: string, reason: string }
6. UNBAN_USER: { email: string }
7. CREATE_CUSTOM_TASK: { title: string, description: string, language: 'cpp'|'python', difficulty: 'easy'|'medium'|'hard' }

Если действие нужно, добавь: [AI_ACTION: { "type": "...", "params": {...}, "description": "..." }]`;

export const AUTO_HEALER_PROMPT = `Ты – AI-диагност платформы DevCourses.
Анализируй ошибки и состояние БД. Ответы на русском.
Если нужен SQL-скрипт: [SQL_FIX: \`\`\`sql ... \`\`\`]
Если проблем нет: "✅ Система здорова."`;

export const AI_MENTOR_PROMPT = `Ты – дружелюбный AI-ментор по программированию.
Помогай подсказками БЕЗ готовых решений. Ответы на русском.
Будь коротким (2-3 предложения), наводящим, вдохновляющим.`;
