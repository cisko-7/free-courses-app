-- =====================================================================
--  DevCourses — патч: разблокировка админа в режиме техработ
--  и устранение ошибки "permission denied for table site_settings".
--
--  Как применить: Supabase Dashboard → SQL Editor → New query →
--  вставьте весь файл → Run. Скрипт идемпотентный (можно запускать повторно).
--  Применяется ПОСЛЕ основного supabase/schema.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Явные табличные права PostgreSQL (GRANT).
--    RLS определяет, КАКИЕ строки видны; GRANT определяет, разрешена ли
--    операция в принципе. Без GRANT запрос падает с permission denied (42501)
--    ещё до проверки RLS-политик.
-- ---------------------------------------------------------------------

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

grant select, insert, update on public.user_accounts to authenticated;

grant select, insert on public.audit_log to authenticated;
grant select, insert on public.email_logs to authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC admin_save_site_settings(payload jsonb) с SECURITY DEFINER.
--    Выполняется с правами владельца функции, поэтому сохраняет настройки
--    гарантированно без ошибок RLS. Внутри всё равно проверяем права
--    администратора (is_admin), чтобы обычный пользователь не смог писать.
--
--    payload — объект со snake_case-полями из lib/site-settings.ts
--    (toSettingsRow): maintenance_mode, maintenance_message, read_only,
--    registration_open, banner_enabled, banner_text, banner_tone.
--    Отсутствующие поля сохраняют текущее значение.
--
--    Важно: берём именно is_admin() (роль из JWT), а не is_admin_verified()
--    (требует ПИН). Иначе экстренный сброс техработ будет недоступен, если
--    админ не вводил ПИН.
-- ---------------------------------------------------------------------

create or replace function public.admin_save_site_settings(payload jsonb)
returns public.site_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.site_settings;
begin
  if not public.is_admin() then
    raise exception 'DC_FORBIDDEN: требуется вход администратора' using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'DC_BAD_PAYLOAD: ожидается JSON-объект' using errcode = '22023';
  end if;

  insert into public.site_settings (id) values (1) on conflict (id) do nothing;

  update public.site_settings as s
  set
    maintenance_mode    = coalesce((payload ->> 'maintenance_mode')::boolean, s.maintenance_mode),
    maintenance_message = coalesce(payload ->> 'maintenance_message', s.maintenance_message),
    read_only           = coalesce((payload ->> 'read_only')::boolean, s.read_only),
    registration_open   = coalesce((payload ->> 'registration_open')::boolean, s.registration_open),
    banner_enabled      = coalesce((payload ->> 'banner_enabled')::boolean, s.banner_enabled),
    banner_text         = coalesce(payload ->> 'banner_text', s.banner_text),
    banner_tone         = coalesce(payload ->> 'banner_tone', s.banner_tone)
  where s.id = 1
  returning s.* into result;

  return result;
end;
$$;

-- Доступ только вошедшим; разграничение прав выполняет is_admin() внутри функции
revoke all on function public.admin_save_site_settings(jsonb) from public, anon;
grant execute on function public.admin_save_site_settings(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Триггер user_accounts_guard: администратор не ограничивается
--    режимом техработ / Read-Only. Это позволяет админу войти и починить
--    настройки, даже когда платформа закрыта на техработы.
--
--    Единственное отличие от supabase/schema.sql — проверка is_admin()
--    вместо is_admin_verified(): право входа/обновления профиля даётся по
--    роли из JWT и не требует ПИН. Разграничение чувствительных полей
--    (is_banned, role, bonus_xp) остаётся прежним ниже в теле триггера.
-- ---------------------------------------------------------------------

create or replace function public.user_accounts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  frozen   boolean;
  reg_open boolean;
begin
  new.completed_items  := public.jsonb_dedupe_array(new.completed_items);
  new.enrolled_courses := public.jsonb_dedupe_array(new.enrolled_courses);

  -- SQL Editor / service_role (auth.uid() is null) не ограничивается
  if auth.uid() is null then
    return new;
  end if;

  -- Администратор не ограничивается техработами/Read-Only: может войти и всё починить.
  -- is_admin() читает роль из JWT (app_metadata) и не требует ПИН.
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.is_banned then
    raise exception 'DC_ACCOUNT_BANNED: %', coalesce(nullif(old.ban_reason, ''), 'аккаунт заблокирован')
      using errcode = 'P0001';
  end if;

  select (s.read_only or s.maintenance_mode), s.registration_open
  into frozen, reg_open
  from public.site_settings s
  where s.id = 1;
  if coalesce(frozen, false) then
    raise exception 'DC_READ_ONLY: платформа временно доступна только для чтения' using errcode = 'P0001';
  end if;
  -- Закрытая регистрация: новый профиль не создаётся
  if tg_op = 'INSERT' and not coalesce(reg_open, true) then
    raise exception 'DC_REGISTRATION_CLOSED: регистрация новых пользователей закрыта' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    new.is_banned  := false;
    new.ban_reason := '';
    new.role       := 'student';
    new.bonus_xp   := 0;
  else
    new.is_banned  := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.role       := old.role;
    new.bonus_xp   := old.bonus_xp;
  end if;
  new.last_seen_at := now();
  return new;
end;
$$;

drop trigger if exists user_accounts_guard on public.user_accounts;
create trigger user_accounts_guard
  before insert or update on public.user_accounts
  for each row execute function public.user_accounts_guard();

-- ---------------------------------------------------------------------
-- 4. Проверка: права выданы, функция создана.
--    Ожидаем true / true в обеих колонках.
-- ---------------------------------------------------------------------

select
  has_table_privilege('authenticated', 'public.site_settings', 'UPDATE')                     as can_update_settings,
  has_function_privilege('authenticated', 'public.admin_save_site_settings(jsonb)', 'EXECUTE') as can_call_rpc;
