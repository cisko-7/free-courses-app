# 🤖 DevCourses AI Autopilot & Auto-Healer

## Описание

Интегрированная система ИИ на базе Google Gemini API для управления платформой DevCourses.

## Возможности

### 1. 🔑 Настройка API-ключа
Админ-панель → 🤖 ИИ-Пилот → Google Gemini API
Ключ: https://aistudio.google.com/apikey

### 2. 💬 AI Admin Commander
Управление командами на русском языке:
- "Дай user@example.com 500 XP"
- "Забань user@example.com"
- "Включи техобслуживание"

### 3. 🏥 AI Auto-Healer
Диагностика и авто-починка системы.

### 4. ✨ ИИ-Ментор
Подсказки ученикам в редакторе кода (cooldown 15 сек).

## Технические детали

**Модули:**
- `lib/ai-autopilot.ts`
- `components/admin/AdminAI.tsx`
- `components/CodeEditorWorkspace.tsx`

**CSP домены:**
- `https://generativelanguage.googleapis.com`
- `https://api.github.com`

## Безопасность

- ✅ Храните ключ в `.env.local`
- ✅ Cooldown защищает от спама
- ⚠️ НЕ коммитьте ключ в git!

## Лимиты

- Gemini Free: 15 req/min, 1500 req/day
- Cooldown: 15 сек
- Timeout: 30 сек
