# Исправление панели администратора и настроек сайта

## Что было исправлено

### 1. Режим технических работ
**Проблема:** Включение режима техработ в админ-панели не работало — пользователи не видели экран техработ.

**Решение:**
- Добавлен импорт `useSiteSettings` и `MaintenanceScreen` в `app/page.tsx`
- Добавлена проверка `siteSettings.maintenanceMode` перед основным JSX
- Если режим техработ включен и пользователь не админ — показывается `MaintenanceScreen`

```typescript
// app/page.tsx (строки 2324-2326, 3185-3188)
const siteSettings = useSiteSettings();

if (siteSettings.maintenanceMode && !isAdminUser) {
  return <MaintenanceScreen message={siteSettings.maintenanceMessage} />;
}
```

### 2. Баннер-объявление
**Проблема:** Баннер-объявление не отображался над шапкой сайта.

**Решение:**
- Добавлен импорт `SiteBanner` в `app/page.tsx`
- Баннер отображается над `<header>` при `siteSettings.bannerEnabled === true`

```typescript
// app/page.tsx (строки 3200-3203)
{siteSettings.bannerEnabled && (
  <SiteBanner text={siteSettings.bannerText} tone={siteSettings.bannerTone} />
)}
```

### 3. AI-Пилот команды
**Проблема:** AI-Пилот в админке не выполнял команды для управления сайтом.

**Решение:**
- Добавлена функция `executeAction` в `components/admin/AdminAI.tsx`
- Реализована обработка AI actions: `TOGGLE_MAINTENANCE`, `UPDATE_BANNER`, `TOGGLE_REGISTRATION`
- AI команды теперь вызывают `saveSiteSettings` и `refreshSiteSettings`

## Как проверить

### 1. Режим техработ
```bash
# 1. Запустите dev-сервер
npm run dev

# 2. Откройте админ-панель
http://localhost:3000/admin

# 3. Введите PIN администратора
# 4. Перейдите на вкладку "⚙️ Настройки"
# 5. Включите "Режим технических работ"
# 6. Нажмите "Сохранить"
# 7. Откройте главную страницу в режиме инкогнито (без прав админа)
# 8. Должен появиться экран "Технические работы"
```

### 2. Баннер-объявление
```bash
# В админ-панели → "⚙️ Настройки":
# 1. Включите "Показывать баннер-объявление"
# 2. Введите текст: "Новый курс Python уже доступен!"
# 3. Выберите тон: "Успех (зелёный)"
# 4. Нажмите "Сохранить"
# 5. Откройте главную страницу
# 6. Над шапкой должен появиться зелёный баннер с текстом
```

### 3. AI-Пилот команды
```bash
# В админ-панели → "🤖 ИИ-Пилот":
# 1. Настройте Gemini API ключ (если ещё не настроен)
# 2. Введите команду: "Включи режим техработ с сообщением: Обновление до версии 2.0"
# 3. AI должен ответить и выполнить действие
# 4. Проверьте вкладку "⚙️ Настройки" — режим техработ должен быть включен
```

## Файлы изменены

1. **app/page.tsx**
   - Добавлен импорт `useSiteSettings`, `MaintenanceScreen`, `SiteBanner`
   - Добавлен хук `useSiteSettings()` в начале компонента App
   - Добавлена проверка режима техработ перед `return`
   - Добавлен баннер над `<header>`

2. **components/admin/AdminAI.tsx**
   - Добавлены импорты: `supabase`, `fetchSiteSettings`, `saveSiteSettings`, `refreshSiteSettings`, `AIAction`
   - Добавлена функция `executeAction` для обработки AI команд
   - Обновлена функция `sendMessage` для выполнения AI actions

## База данных

Таблица `site_settings` уже существует в схеме БД (`supabase/schema.sql`):

```sql
create table public.site_settings (
  id                  smallint primary key default 1,
  maintenance_mode    boolean not null default false,
  maintenance_message text not null default 'Идут технические работы. Скоро вернёмся!',
  read_only           boolean not null default false,
  registration_open   boolean not null default true,
  banner_enabled      boolean not null default false,
  banner_text         text not null default '',
  banner_tone         text not null default 'info',
  updated_at          timestamptz not null default now()
);
```

Триггер `user_accounts_guard` блокирует запись в БД при `maintenance_mode = true` (строка защиты на уровне базы данных).

## Безопасность

- Настройки сайта читают все пользователи (RLS policy: "site_settings: public read")
- Изменять настройки может только подтверждённый администратор (RLS policy: "site_settings: admin update")
- Триггер БД блокирует запись при техработах (обойти с клиента нельзя)
- AI-Пилот доступен только администраторам через PIN-защищённую админ-панель

## Проверка сборки

```bash
# TypeScript проверка
npx tsc --noEmit
# ✓ Без ошибок

# Production сборка
npm run build
# ✓ Скомпилировано успешно (3 страницы: /, /admin, /_not-found)
```
