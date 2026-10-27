-- ================================================================
-- АКТУАЛЬНАЯ СХЕМА АДМИНИСТРАТОРА (версия 2026-10-25)
-- Полная переустановка таблиц и функций
-- ================================================================

-- Шаг 1: Пересоздать таблицы с нуля
drop table if exists public.admin_pin_attempts cascade;
drop table if exists public.admin_secrets cascade;

-- Шаг 2: Создать таблицу с хешем ПИНа
create table public.admin_secrets (
  id                smallint primary key default 1,
  pin_hash          text not null,
  updated_at        timestamptz not null default now(),
  constraint only_one_row check (id = 1)
);
alter table public.admin_secrets enable row level security;
create policy "admin_secrets: no access"
  on public.admin_secrets for all
  to public, anon, authenticated
  using (false);

-- Шаг 3: Создать таблицу с историей попыток
create table public.admin_pin_attempts (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  success           boolean not null default false,
  attempted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index idx_admin_pin_attempts_user_id on public.admin_pin_attempts(user_id);

alter table public.admin_pin_attempts enable row level security;
create policy "admin_pin_attempts: insert own"
  on public.admin_pin_attempts for insert
  to authenticated
  with check (user_id = auth.uid());

-- Шаг 4: Пересоздать функции верификации
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
$$;

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

create or replace function public.admin_set_pin(pin_input text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_hash text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  pin_hash := extensions.crypt(pin_input, extensions.gen_salt('bf', 10));
  insert into public.admin_secrets (id, pin_hash, updated_at)
  values (1, pin_hash, now())
  on conflict (id) do update
  set pin_hash = excluded.pin_hash, updated_at = now();
  return jsonb_build_object('ok', true, 'pin_set', true);
end;
$$;

create or replace function public.admin_verify_pin(pin_input text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_hash text;
  is_correct boolean;
  current_uid uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  current_uid := auth.uid();
  select ph.pin_hash into pin_hash from public.admin_secrets ph where ph.id = 1;
  if pin_hash is null then
    insert into public.admin_pin_attempts (user_id, success)
    values (current_uid, true);
    return jsonb_build_object('ok', true, 'verified', true);
  end if;
  is_correct := extensions.crypt(pin_input, pin_hash) = pin_hash;
  insert into public.admin_pin_attempts (user_id, success)
  values (current_uid, is_correct);
  if is_correct then
    return jsonb_build_object('ok', true, 'verified', true);
  else
    return jsonb_build_object('ok', false, 'verified', false, 'reason', 'wrong_pin');
  end if;
end;
$$;

create or replace function public.admin_end_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  delete from public.admin_pin_attempts
  where user_id = auth.uid()
    and success
    and attempted_at > now() - interval '30 minutes';
  return jsonb_build_object('ok', true, 'session_ended', true);
end;
$$;

create or replace function public.admin_pin_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'admin', public.is_admin(),
    'pin_set', exists (select 1 from public.admin_secrets where id = 1),
    'verified', public.is_admin_verified()
  ) into result;
  return result;
end;
$$;

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

-- Шаг 5: Установить права доступа
revoke all on function public.is_admin_verified()     from public, anon;
revoke all on function public.admin_verify_pin(text)  from public, anon;
revoke all on function public.admin_set_pin(text)     from public, anon;
revoke all on function public.admin_end_session()     from public, anon;
revoke all on function public.admin_pin_status()      from public, anon;
revoke all on function public.admin_stats()           from public, anon;

grant execute on function public.is_admin_verified()     to authenticated;
grant execute on function public.admin_verify_pin(text)  to authenticated;
grant execute on function public.admin_set_pin(text)     to authenticated;
grant execute on function public.admin_end_session()     to authenticated;
grant execute on function public.admin_pin_status()      to authenticated;
grant execute on function public.admin_stats()           to authenticated;

-- ================================================================
-- ГОТОВО! Все функции и таблицы переустановлены. ✅
-- ================================================================

create policy "admin_pin_attempts: read own"
  on public.admin_pin_attempts for select
  to authenticated
  using (user_id = auth.uid());
