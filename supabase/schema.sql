-- =====================================================================
--  DevCourses — схема базы данных Supabase
--  Как применить: Supabase Dashboard → SQL Editor → New query →
--  вставьте весь файл → Run. Скрипт идемпотентный: его можно
--  запускать повторно, существующие данные не удаляются.
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

-- Уникальный email обязателен: приложение делает upsert(..., { onConflict: 'email' })
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

create policy "user_accounts: delete own"
  on public.user_accounts for delete
  to authenticated
  using (email = public.current_email());

-- Администратор может читать все профили (например, для статистики)
create policy "user_accounts: admin select"
  on public.user_accounts for select
  to authenticated
  using (public.is_admin());

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
  with check (public.is_admin());

create policy "courses: admin update"
  on public.courses for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "courses: admin delete"
  on public.courses for delete
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.courses from anon;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;

-- ---------------------------------------------------------------------
-- 5. Назначить администратора (раскомментируйте и подставьте свой email).
--    После этого выйдите из аккаунта и войдите снова — роль попадёт в JWT.
-- ---------------------------------------------------------------------

-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- where email = 'your-admin@yandex.ru';

-- ---------------------------------------------------------------------
-- 6. Проверка: результат последних двух запросов покажется в SQL Editor
-- ---------------------------------------------------------------------

-- RLS включён на обеих таблицах (ожидается relrowsecurity = true)
select relname, relrowsecurity
from pg_class
where relname in ('user_accounts', 'courses')
  and relnamespace = 'public'::regnamespace;

-- Список политик
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('user_accounts', 'courses')
order by tablename, policyname;
