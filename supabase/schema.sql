-- =====================================================================
--  DevCourses — схема базы данных Supabase
--  Как применить: Supabase Dashboard → SQL Editor → New query →
--  вставьте весь файл → Run. Скрипт идемпотентный: его можно
--  запускать повторно.
--
--  Единственное изменение данных: строки-дубликаты user_accounts
--  с одинаковым email объединяются в одну (прогресс сливается).
--  Перед этим все такие строки копируются в user_accounts_dedupe_backup.
--
--  Что НЕЛЬЗЯ сделать SQL-скриптом (настраивается в Dashboard):
--   * полностью закрыть регистрацию: Authentication → Sign In / Providers →
--     «Allow new users to sign up». Флаг registration_open в site_settings
--     скрывает форму и запрещает создание профиля, но не Auth-аккаунта;
--   * минимальная длина пароля: Authentication → Policies (рекомендуется 8).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Вспомогательные функции
-- ---------------------------------------------------------------------

-- Email текущего пользователя из JWT (в нижнем регистре, как в приложении)
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Роль администратора хранится в app_metadata: пользователь не может
-- изменить её сам (в отличие от user_metadata)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Автоматическое обновление updated_at при любом UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Массив JSON без дубликатов (порядок первых вхождений сохраняется).
-- Дубликаты в completed_items раньше раздували XP.
create or replace function public.jsonb_dedupe_array(arr jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(s.x) order by s.first_ord), '[]'::jsonb)
  from (
    select t.x, min(t.ord) as first_ord
    from jsonb_array_elements_text(
      case when jsonb_typeof(arr) = 'array' then arr else '[]'::jsonb end
    ) with ordinality as t(x, ord)
    group by t.x
  ) s;
$$;

-- Администратор, подтвердивший ПИН за последние 30 минут (или ПИН ещё не задан).
-- plpgsql: таблицы ПИНа создаются ниже, тело проверяется только при вызове.
create or replace function public.is_admin_verified()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if not exists (select 1 from public.admin_secrets where id = 1) then
    return true;
  end if;
  return exists (
    select 1 from public.admin_pin_attempts
    where user_id = auth.uid()
      and success
      and attempted_at > now() - interval '30 minutes'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Таблица профилей учеников: user_accounts
--    Поля совпадают с интерфейсом UserAccount в lib/auth-utils.ts
-- ---------------------------------------------------------------------

create table if not exists public.user_accounts (
  id               uuid        primary key default gen_random_uuid(),
  -- Связь с auth.users; заполняется автоматически из JWT
  user_id          uuid        references auth.users (id) on delete cascade default auth.uid(),
  email            text        not null,
  display_name     text        not null default 'Студент DevCourses',
  avatar           text        not null default '👨‍💻',
  bio              text        not null default '',
  enrolled_courses jsonb       not null default '["cpp-basics"]'::jsonb,
  completed_items  jsonb       not null default '[]'::jsonb,
  user_code_map    jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Ограничения от мусора и злоупотреблений
  constraint user_accounts_email_lower    check (email = lower(email)),
  constraint user_accounts_email_format   check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint user_accounts_name_len       check (char_length(display_name) between 1 and 60),
  constraint user_accounts_avatar_len     check (char_length(avatar) <= 16),
  constraint user_accounts_bio_len        check (char_length(bio) <= 500),
  constraint user_accounts_enrolled_arr   check (jsonb_typeof(enrolled_courses) = 'array'),
  constraint user_accounts_completed_arr  check (jsonb_typeof(completed_items) = 'array'),
  constraint user_accounts_code_map_obj   check (jsonb_typeof(user_code_map) = 'object'),
  -- Не больше ~1 МБ кода на пользователя
  constraint user_accounts_code_map_size  check (pg_column_size(user_code_map) < 1048576)
);

-- Если таблица уже существовала — докидываем недостающие колонки
alter table public.user_accounts add column if not exists user_id    uuid references auth.users (id) on delete cascade default auth.uid();
alter table public.user_accounts add column if not exists bio        text not null default '';
alter table public.user_accounts add column if not exists avatar     text not null default '👨‍💻';
alter table public.user_accounts add column if not exists created_at timestamptz not null default now();
alter table public.user_accounts add column if not exists updated_at timestamptz not null default now();

-- Старая колонка password: пароли хранит Supabase Auth (auth.users, в виде хеша),
-- приложение в эту колонку ничего не пишет. NOT NULL на ней ломает регистрацию (ошибка 23502).
-- Снимаем ограничение — безопасно, данные не удаляются.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_accounts' and column_name = 'password'
  ) then
    alter table public.user_accounts alter column password drop not null;
  end if;
end;
$$;

-- РЕКОМЕНДУЕТСЯ: полностью удалить колонку, если в ней лежат пароли открытым текстом.
-- Необратимо: удаляет данные колонки. Раскомментируйте, когда будете готовы.
-- alter table public.user_accounts drop column if exists password;

-- ---------------------------------------------------------------------
-- 1a. Дедупликация перед уникальным ограничением по email.
--     Все строки-дубликаты сначала копируются в user_accounts_dedupe_backup,
--     затем прогресс сливается в самую свежую строку, остальные удаляются.
--     Восстановление: select row_data from public.user_accounts_dedupe_backup;
-- ---------------------------------------------------------------------

create table if not exists public.user_accounts_dedupe_backup (
  backup_id    bigint      generated always as identity primary key,
  original_id  uuid,
  email        text,
  row_data     jsonb       not null,
  backed_up_at timestamptz not null default now()
);
alter table public.user_accounts_dedupe_backup enable row level security;
revoke all on public.user_accounts_dedupe_backup from anon, authenticated;

do $$
declare
  rec     record;
  keep_id uuid;
begin
  for rec in
    select lower(email) as e
    from public.user_accounts
    group by lower(email)
    having count(*) > 1
  loop
    insert into public.user_accounts_dedupe_backup (original_id, email, row_data)
    select ua.id, ua.email, to_jsonb(ua)
    from public.user_accounts ua
    where lower(ua.email) = rec.e;

    select ua.id into keep_id
    from public.user_accounts ua
    where lower(ua.email) = rec.e
    order by ua.updated_at desc nulls last, ua.created_at asc
    limit 1;

    update public.user_accounts k
    set
      user_id = coalesce(
        k.user_id,
        (select u.user_id from public.user_accounts u
         where lower(u.email) = rec.e and u.user_id is not null limit 1)
      ),
      completed_items = (
        select public.jsonb_dedupe_array(coalesce(jsonb_agg(x.value), '[]'::jsonb))
        from public.user_accounts u
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(u.completed_items) = 'array' then u.completed_items else '[]'::jsonb end
        ) as x(value)
        where lower(u.email) = rec.e
      ),
      enrolled_courses = (
        select public.jsonb_dedupe_array(coalesce(jsonb_agg(x.value), '[]'::jsonb))
        from public.user_accounts u
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(u.enrolled_courses) = 'array' then u.enrolled_courses else '[]'::jsonb end
        ) as x(value)
        where lower(u.email) = rec.e
      ),
      -- Код задачи берём из сохраняемой строки, недостающие задачи — из самых свежих дубликатов
      user_code_map = (
        select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
        from (
          select distinct on (kv.key) kv.key, kv.value
          from public.user_accounts u
          cross join lateral jsonb_each(
            case when jsonb_typeof(u.user_code_map) = 'object' then u.user_code_map else '{}'::jsonb end
          ) as kv(key, value)
          where lower(u.email) = rec.e
          order by kv.key, (u.id = keep_id) desc, u.updated_at desc nulls last
        ) s
      )
    where k.id = keep_id;

    delete from public.user_accounts where lower(email) = rec.e and id <> keep_id;
    -- Email приводим к нижнему регистру только после удаления дубликатов (иначе конфликт уникальности)
    update public.user_accounts set email = rec.e where id = keep_id and email <> rec.e;
    raise notice 'user_accounts: объединены дубликаты для %', rec.e;
  end loop;
end;
$$;

-- Email в нижнем регистре и прогресс без повторов во всех строках
update public.user_accounts set email = lower(email) where email <> lower(email);
update public.user_accounts
set completed_items  = public.jsonb_dedupe_array(completed_items),
    enrolled_courses = public.jsonb_dedupe_array(enrolled_courses)
where completed_items  <> public.jsonb_dedupe_array(completed_items)
   or enrolled_courses <> public.jsonb_dedupe_array(enrolled_courses);

-- Уникальный email обязателен: приложение ищет профиль по email
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_accounts_email_key'
      and conrelid = 'public.user_accounts'::regclass
  ) then
    alter table public.user_accounts
      add constraint user_accounts_email_key unique (email);
  end if;
end;
$$;

create index if not exists user_accounts_user_id_idx on public.user_accounts (user_id);

drop trigger if exists user_accounts_set_updated_at on public.user_accounts;
create trigger user_accounts_set_updated_at
  before update on public.user_accounts
  for each row execute function public.set_updated_at();

-- Защита от подмены: user_id всегда = текущий пользователь, email всегда = email из JWT.
-- service_role (серверные скрипты, SQL Editor) этой проверкой не ограничивается.
create or replace function public.user_accounts_enforce_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new; -- SQL Editor / service_role
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.email   := public.current_email();
  else
    -- Владельца, email и дату создания менять нельзя
    new.user_id    := old.user_id;
    new.email      := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists user_accounts_enforce_owner on public.user_accounts;
create trigger user_accounts_enforce_owner
  before insert or update on public.user_accounts
  for each row execute function public.user_accounts_enforce_owner();

-- Привязываем старые строки (созданные до появления user_id) к auth.users по email
update public.user_accounts ua
set user_id = u.id
from auth.users u
where ua.user_id is null
  and lower(u.email) = ua.email;

-- ---------------------------------------------------------------------
-- 1b. Служебные колонки: бан, роль, активность, бонус и вычисляемый XP.
--     Пользователь не может менять их сам (триггер user_accounts_guard ниже).
-- ---------------------------------------------------------------------

alter table public.user_accounts add column if not exists is_banned    boolean     not null default false;
alter table public.user_accounts add column if not exists ban_reason   text        not null default '';
alter table public.user_accounts add column if not exists role         text        not null default 'student';
alter table public.user_accounts add column if not exists last_seen_at timestamptz;
alter table public.user_accounts add column if not exists bonus_xp     integer     not null default 0;
-- XP считается в БД: клиент не может его подделать. completed_items без дубликатов (см. триггер)
alter table public.user_accounts add column if not exists xp integer
  generated always as (
    (case when jsonb_typeof(completed_items) = 'array' then jsonb_array_length(completed_items) else 0 end) * 50
    + bonus_xp
  ) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_accounts_role_check') then
    alter table public.user_accounts add constraint user_accounts_role_check check (role in ('student', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_accounts_ban_reason_len') then
    alter table public.user_accounts add constraint user_accounts_ban_reason_len check (char_length(ban_reason) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_accounts_bonus_xp_range') then
    alter table public.user_accounts add constraint user_accounts_bonus_xp_range check (bonus_xp between 0 and 1000000);
  end if;
end;
$$;

create index if not exists user_accounts_xp_idx         on public.user_accounts (xp desc) where not is_banned;
create index if not exists user_accounts_last_seen_idx  on public.user_accounts (last_seen_at desc);
create index if not exists user_accounts_created_at_idx on public.user_accounts (created_at desc);

-- Защитный триггер для обычных пользователей:
--   * забаненный не может менять профиль (маркер DC_ACCOUNT_BANNED ловит клиент);
--   * режим Read-Only / техработы блокирует запись (маркер DC_READ_ONLY);
--   * is_banned, ban_reason, role, bonus_xp меняет только администратор;
--   * прогресс очищается от дубликатов, last_seen_at ставится сервером.
-- SQL Editor / service_role (auth.uid() is null) и подтверждённый администратор не ограничиваются.
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

  -- Отдельные проверки: в SQL порядок вычисления OR не гарантирован
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin_verified() then
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
  -- Закрытая регистрация: новый профиль не создаётся (сам вход в Auth закрывается в Dashboard)
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
-- 2. RLS для user_accounts: каждый видит и меняет только свою строку
-- ---------------------------------------------------------------------

alter table public.user_accounts enable row level security;

drop policy if exists "user_accounts: select own"   on public.user_accounts;
drop policy if exists "user_accounts: insert own"   on public.user_accounts;
drop policy if exists "user_accounts: update own"   on public.user_accounts;
drop policy if exists "user_accounts: delete own"   on public.user_accounts;
drop policy if exists "user_accounts: admin select" on public.user_accounts;

create policy "user_accounts: select own"
  on public.user_accounts for select
  to authenticated
  using (email = public.current_email());

create policy "user_accounts: insert own"
  on public.user_accounts for insert
  to authenticated
  with check (email = public.current_email());

-- upsert при повторной регистрации идёт через UPDATE — он тоже ограничен своей строкой
create policy "user_accounts: update own"
  on public.user_accounts for update
  to authenticated
  using (email = public.current_email())
  with check (email = public.current_email());

-- Забаненный не может удалить строку: иначе он пересоздал бы её без бана
create policy "user_accounts: delete own"
  on public.user_accounts for delete
  to authenticated
  using (email = public.current_email() and not is_banned);

-- Администратор (с подтверждённым ПИНом) читает и меняет все профили.
-- (select ...) — Postgres вычисляет функцию один раз на запрос, а не на каждую строку.
drop policy if exists "user_accounts: admin update" on public.user_accounts;
drop policy if exists "user_accounts: admin delete" on public.user_accounts;

create policy "user_accounts: admin select"
  on public.user_accounts for select
  to authenticated
  using ((select public.is_admin_verified()));

create policy "user_accounts: admin update"
  on public.user_accounts for update
  to authenticated
  using ((select public.is_admin_verified()))
  with check ((select public.is_admin_verified()));

create policy "user_accounts: admin delete"
  on public.user_accounts for delete
  to authenticated
  using ((select public.is_admin_verified()));

-- Гости (anon) не имеют доступа к профилям вообще
revoke all on public.user_accounts from anon;
grant select, insert, update, delete on public.user_accounts to authenticated;

-- ---------------------------------------------------------------------
-- 3. Таблица курсов: courses (используется в app/page.tsx и app/admin/page.tsx)
--    Приложение пишет: id, title, language, data; читает: data по created_at
-- ---------------------------------------------------------------------

create table if not exists public.courses (
  id         text        primary key,
  title      text        not null,
  language   text        not null,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint courses_title_len    check (char_length(title) between 1 and 200),
  constraint courses_language_len check (char_length(language) between 1 and 32),
  constraint courses_data_obj     check (jsonb_typeof(data) = 'object'),
  constraint courses_data_size    check (pg_column_size(data) < 5242880) -- до 5 МБ на курс
);

alter table public.courses add column if not exists created_at timestamptz not null default now();
alter table public.courses add column if not exists updated_at timestamptz not null default now();

create index if not exists courses_created_at_idx on public.courses (created_at);

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS для courses: читать могут все, менять — только администратор
-- ---------------------------------------------------------------------

alter table public.courses enable row level security;

drop policy if exists "courses: public read"  on public.courses;
drop policy if exists "courses: admin insert" on public.courses;
drop policy if exists "courses: admin update" on public.courses;
drop policy if exists "courses: admin delete" on public.courses;

create policy "courses: public read"
  on public.courses for select
  to anon, authenticated
  using (true);

create policy "courses: admin insert"
  on public.courses for insert
  to authenticated
  with check ((select public.is_admin_verified()));

create policy "courses: admin update"
  on public.courses for update
  to authenticated
  using ((select public.is_admin_verified()))
  with check ((select public.is_admin_verified()));

create policy "courses: admin delete"
  on public.courses for delete
  to authenticated
  using ((select public.is_admin_verified()));

revoke insert, update, delete on public.courses from anon;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;

-- ---------------------------------------------------------------------
-- 5. Настройки сайта: одна строка id = 1. Читают все, меняет администратор.
--    Техработы, Read-Only и закрытая регистрация дополнительно
--    применяются триггером user_accounts_guard (обойти с клиента нельзя).
-- ---------------------------------------------------------------------

create table if not exists public.site_settings (
  id                  smallint    primary key default 1,
  maintenance_mode    boolean     not null default false,
  maintenance_message text        not null default 'Идут технические работы. Скоро вернёмся!',
  read_only           boolean     not null default false,
  registration_open   boolean     not null default true,
  banner_enabled      boolean     not null default false,
  banner_text         text        not null default '',
  banner_tone         text        not null default 'info',
  updated_at          timestamptz not null default now(),
  updated_by          uuid,

  constraint site_settings_singleton   check (id = 1),
  constraint site_settings_message_len check (char_length(maintenance_message) <= 500),
  constraint site_settings_banner_len  check (char_length(banner_text) <= 300),
  constraint site_settings_banner_tone check (banner_tone in ('info', 'success', 'warning', 'danger'))
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.site_settings_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id         := 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists site_settings_stamp on public.site_settings;
create trigger site_settings_stamp
  before update on public.site_settings
  for each row execute function public.site_settings_stamp();

alter table public.site_settings enable row level security;
drop policy if exists "site_settings: public read"  on public.site_settings;
drop policy if exists "site_settings: admin update" on public.site_settings;

create policy "site_settings: public read"
  on public.site_settings for select
  to anon, authenticated
  using (true);

create policy "site_settings: admin update"
  on public.site_settings for update
  to authenticated
  using ((select public.is_admin_verified()))
  with check ((select public.is_admin_verified()));

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

-- ---------------------------------------------------------------------
-- 6. Журнал писем EmailJS. Письма отправляет браузер, поэтому запись
--    делает клиент: только о письме на свой email, не больше 20 в час.
-- ---------------------------------------------------------------------

create table if not exists public.email_logs (
  id         bigint      generated always as identity primary key,
  user_id    uuid        default auth.uid() references auth.users (id) on delete set null,
  recipient  text        not null,
  template   text        not null default 'confirmation',
  status     text        not null,
  error      text        not null default '',
  created_at timestamptz not null default now(),

  constraint email_logs_status        check (status in ('sent', 'failed')),
  constraint email_logs_recipient_len check (char_length(recipient) <= 254),
  constraint email_logs_template_len  check (char_length(template) between 1 and 64),
  constraint email_logs_error_len     check (char_length(error) <= 1000)
);

create index if not exists email_logs_created_at_idx on public.email_logs (created_at desc);
create index if not exists email_logs_user_idx       on public.email_logs (user_id, created_at desc);

create or replace function public.email_logs_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.user_id    := auth.uid();
  new.created_at := now();
  if (select count(*) from public.email_logs
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'DC_RATE_LIMIT: слишком много записей журнала писем' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists email_logs_rate_limit on public.email_logs;
create trigger email_logs_rate_limit
  before insert on public.email_logs
  for each row execute function public.email_logs_rate_limit();

alter table public.email_logs enable row level security;
drop policy if exists "email_logs: insert own"   on public.email_logs;
drop policy if exists "email_logs: admin select" on public.email_logs;
drop policy if exists "email_logs: admin delete" on public.email_logs;

create policy "email_logs: insert own"
  on public.email_logs for insert
  to authenticated
  with check (lower(recipient) = public.current_email() or (select public.is_admin_verified()));

create policy "email_logs: admin select"
  on public.email_logs for select
  to authenticated
  using ((select public.is_admin_verified()));

create policy "email_logs: admin delete"
  on public.email_logs for delete
  to authenticated
  using ((select public.is_admin_verified()));

revoke all on public.email_logs from anon, authenticated;
grant insert, select, delete on public.email_logs to authenticated;

-- ---------------------------------------------------------------------
-- 7. Журнал действий администратора (только добавление, без правки и удаления).
--    Бан, бонусы, удаление профилей и настройки пишутся триггерами на сервере,
--    прочие действия (публикация курсов, тестовое письмо) — клиентом.
-- ---------------------------------------------------------------------

create table if not exists public.audit_log (
  id          bigint      generated always as identity primary key,
  actor_id    uuid        default auth.uid(),
  actor_email text        not null default '',
  action      text        not null,
  target      text        not null default '',
  details     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint audit_log_action_len   check (char_length(action) between 1 and 64),
  constraint audit_log_target_len   check (char_length(target) <= 254),
  constraint audit_log_details_obj  check (jsonb_typeof(details) = 'object'),
  constraint audit_log_details_size check (pg_column_size(details) < 16384)
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- Автора записи нельзя подделать
create or replace function public.audit_log_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.actor_id    := auth.uid();
    new.actor_email := public.current_email();
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists audit_log_stamp on public.audit_log;
create trigger audit_log_stamp
  before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

alter table public.audit_log enable row level security;
drop policy if exists "audit_log: admin insert" on public.audit_log;
drop policy if exists "audit_log: admin select" on public.audit_log;

create policy "audit_log: admin insert"
  on public.audit_log for insert
  to authenticated
  with check ((select public.is_admin_verified()));

create policy "audit_log: admin select"
  on public.audit_log for select
  to authenticated
  using ((select public.is_admin_verified()));

revoke all on public.audit_log from anon, authenticated;
grant insert, select on public.audit_log to authenticated;

-- Серверный аудит изменений, сделанных администратором в чужих профилях
create or replace function public.user_accounts_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'DELETE' then
    if old.email <> public.current_email() then
      insert into public.audit_log (action, target, details)
      values ('user.delete_profile', old.email, jsonb_build_object('xp', old.xp));
    end if;
    return null;
  end if;
  if new.is_banned is distinct from old.is_banned then
    insert into public.audit_log (action, target, details)
    values (case when new.is_banned then 'user.ban' else 'user.unban' end, new.email,
            jsonb_build_object('reason', new.ban_reason));
  end if;
  if new.bonus_xp is distinct from old.bonus_xp then
    insert into public.audit_log (action, target, details)
    values ('user.bonus_xp', new.email, jsonb_build_object('from', old.bonus_xp, 'to', new.bonus_xp));
  end if;
  if new.role is distinct from old.role then
    insert into public.audit_log (action, target, details)
    values ('user.role', new.email, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return null;
end;
$$;

drop trigger if exists user_accounts_audit on public.user_accounts;
create trigger user_accounts_audit
  after update or delete on public.user_accounts
  for each row execute function public.user_accounts_audit();

-- Аудит настроек: в журнал попадают только изменившиеся поля
create or replace function public.site_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  diff jsonb;
begin
  select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into diff
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key not in ('updated_at', 'updated_by');
  if diff <> '{}'::jsonb then
    insert into public.audit_log (action, target, details) values ('settings.update', 'site_settings', diff);
  end if;
  return null;
end;
$$;

drop trigger if exists site_settings_audit on public.site_settings;
create trigger site_settings_audit
  after update on public.site_settings
  for each row execute function public.site_settings_audit();

-- ---------------------------------------------------------------------
-- 8. ПИН администратора: второй фактор для админки.
--    Хранится только bcrypt-хеш; таблицы закрыты для клиента полностью,
--    проверка — через RPC admin_verify_pin (не больше 5 ошибок за 10 минут).
--    Пока ПИН не задан, админке достаточно роли admin.
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_secrets (
  id         smallint    primary key default 1,
  pin_hash   text        not null,
  updated_at timestamptz not null default now(),
  constraint admin_secrets_singleton check (id = 1)
);

create table if not exists public.admin_pin_attempts (
  id           bigint      generated always as identity primary key,
  user_id      uuid        not null,
  success      boolean     not null,
  attempted_at timestamptz not null default now()
);

create index if not exists admin_pin_attempts_user_idx on public.admin_pin_attempts (user_id, attempted_at desc);

alter table public.admin_secrets      enable row level security;
alter table public.admin_pin_attempts enable row level security;
-- Политик нет намеренно: доступ только через security definer функции
revoke all on public.admin_secrets      from anon, authenticated;
revoke all on public.admin_pin_attempts from anon, authenticated;

create or replace function public.admin_verify_pin(pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  stored   text;
  failures int;
  oldest   timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  select s.pin_hash into stored from public.admin_secrets s where s.id = 1;
  if stored is null then
    return jsonb_build_object('ok', true, 'pin_required', false);
  end if;

  select count(*), min(a.attempted_at) into failures, oldest
  from public.admin_pin_attempts a
  where a.user_id = auth.uid() and not a.success and a.attempted_at > now() - interval '10 minutes';

  if failures >= 5 then
    return jsonb_build_object(
      'ok', false, 'reason', 'locked',
      'retry_after_sec', greatest(1, ceil(extract(epoch from (oldest + interval '10 minutes' - now())))::int)
    );
  end if;

  if pin is not null and char_length(pin) between 4 and 32 and extensions.crypt(pin, stored) = stored then
    -- Успех: старые ошибки больше не учитываются
    delete from public.admin_pin_attempts where user_id = auth.uid();
    insert into public.admin_pin_attempts (user_id, success) values (auth.uid(), true);
    insert into public.audit_log (action, target) values ('admin.pin_ok', public.current_email());
    return jsonb_build_object('ok', true, 'pin_required', true, 'expires_in_sec', 1800);
  end if;

  insert into public.admin_pin_attempts (user_id, success) values (auth.uid(), false);
  insert into public.audit_log (action, target) values ('admin.pin_failed', public.current_email());
  return jsonb_build_object('ok', false, 'reason', 'wrong_pin', 'attempts_left', greatest(0, 4 - failures));
end;
$$;

-- Смена ПИНа (только после подтверждения текущего). ПИН: 4–12 цифр.
create or replace function public.admin_set_pin(new_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_verified() then
    return jsonb_build_object('ok', false, 'reason', 'not_verified');
  end if;
  if new_pin is null or new_pin !~ '^[0-9]{4,12}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_pin');
  end if;
  insert into public.admin_secrets (id, pin_hash, updated_at)
  values (1, extensions.crypt(new_pin, extensions.gen_salt('bf', 10)), now())
  on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  -- Новый ПИН сразу считается подтверждённым для текущего администратора
  delete from public.admin_pin_attempts where user_id = auth.uid();
  insert into public.admin_pin_attempts (user_id, success) values (auth.uid(), true);
  insert into public.audit_log (action, target) values ('admin.pin_changed', public.current_email());
  return jsonb_build_object('ok', true);
end;
$$;

-- Состояние ПИНа без траты попытки: задан ли он и подтверждён ли для текущей сессии
create or replace function public.admin_pin_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('admin', false, 'pin_set', false, 'verified', false);
  end if;
  return jsonb_build_object(
    'admin', true,
    'pin_set', exists (select 1 from public.admin_secrets where id = 1),
    'verified', public.is_admin_verified()
  );
end;
$$;

-- Выход из админки: подтверждение ПИНа сбрасывается и на сервере
create or replace function public.admin_end_session()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.admin_pin_attempts where user_id = auth.uid() and success;
$$;

-- ---------------------------------------------------------------------
-- 9. RPC для приложения
-- ---------------------------------------------------------------------

-- Лидерборд: только имя, аватар и XP (без email). is_me — строка текущего пользователя,
-- она возвращается дополнительно, даже если не входит в топ.
create or replace function public.get_leaderboard(lim int default 10)
returns table (place bigint, display_name text, avatar text, xp int, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      rank() over (order by ua.xp desc, ua.created_at asc) as place,
      ua.display_name,
      ua.avatar,
      ua.xp,
      (ua.email = public.current_email()) as is_me
    from public.user_accounts ua
    where not ua.is_banned and ua.xp > 0
  )
  select r.place, r.display_name, r.avatar, r.xp, r.is_me
  from ranked r
  where r.place <= least(greatest(coalesce(lim, 10), 1), 50) or r.is_me
  order by r.place
  limit least(greatest(coalesce(lim, 10), 1), 50) + 1;
$$;

-- Сводка для дашборда администратора
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin_verified() then
    raise exception 'DC_FORBIDDEN: требуется вход администратора' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_users',       (select count(*) from public.user_accounts),
    'total_banned',      (select count(*) from public.user_accounts where is_banned),
    'total_admins',      (select count(*) from auth.users where raw_app_meta_data ->> 'role' = 'admin'),
    'total_xp',          (select coalesce(sum(xp), 0) from public.user_accounts where not is_banned),
    'recent_logins',     (select count(*) from public.user_accounts where last_seen_at > now() - interval '7 days'),
    'oldest_account',    (select min(created_at)::text from public.user_accounts),
    'newest_account',    (select max(created_at)::text from public.user_accounts)
  ) into result;
  return result;
end;
$$;

-- Функции доступны только вошедшим пользователям; права внутри проверяются отдельно
revoke all on function public.is_admin_verified()     from public, anon;
revoke all on function public.admin_verify_pin(text)  from public, anon;
revoke all on function public.admin_set_pin(text)     from public, anon;
revoke all on function public.admin_end_session()     from public, anon;
revoke all on function public.admin_pin_status()      from public, anon;
grant execute on function public.admin_pin_status()      to authenticated;
revoke all on function public.admin_stats()           from public, anon;
revoke all on function public.get_leaderboard(int)    from public, anon;
grant execute on function public.is_admin_verified()     to authenticated;
grant execute on function public.admin_verify_pin(text)  to authenticated;
grant execute on function public.admin_set_pin(text)     to authenticated;
grant execute on function public.admin_end_session()     to authenticated;
grant execute on function public.admin_stats()           to authenticated;
grant execute on function public.get_leaderboard(int)    to authenticated;

-- ---------------------------------------------------------------------
-- 10. Назначить администратора (раскомментируйте и подставьте свой email).
--     После этого выйдите из аккаунта и войдите снова — роль попадёт в JWT.
--     Первый ПИН (4–12 цифр) задаётся в админке → «Безопасность».
-- ---------------------------------------------------------------------

-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- where email = 'your-admin@yandex.ru';

-- Первый ПИН можно задать и здесь (4–12 цифр), заменив 000000:
-- insert into public.admin_secrets (id, pin_hash)
-- values (1, extensions.crypt('000000', extensions.gen_salt('bf', 10)))
-- on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();

-- ---------------------------------------------------------------------
-- 11. Проверка: результат последних запросов покажется в SQL Editor
-- ---------------------------------------------------------------------

-- RLS включён на всех таблицах (ожидается relrowsecurity = true)
select relname, relrowsecurity
from pg_class
where relname in ('user_accounts', 'courses', 'site_settings', 'email_logs', 'audit_log',
                  'admin_secrets', 'admin_pin_attempts', 'user_accounts_dedupe_backup')
  and relnamespace = 'public'::regnamespace
order by relname;

-- Дубликатов email быть не должно (ожидается пустой результат)
select email, count(*) from public.user_accounts group by email having count(*) > 1;

-- Список политик
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
