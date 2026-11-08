-- Phase 1 · profiles (spec §D.2 #1, §B.1, §B.2)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  handle extensions.citext not null unique check (handle::text ~ '^[a-z0-9_]{3,20}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https?://'),
  job_title text check (job_title is null or char_length(job_title) <= 80),
  timezone text not null default 'Asia/Kolkata',
  week_start smallint not null default 1 check (week_start in (0, 1)),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reduced_motion boolean not null default false,
  weekend_streak_protection boolean not null default true,
  show_on_leaderboard boolean not null default true,
  notification_prefs jsonb not null default '{}'::jsonb,
  last_workspace_id uuid, -- FK added in p1_workspaces_core
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public user profile, 1:1 with auth.users; created by handle_new_user().';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Timezone must be a real IANA zone known to Postgres.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'VALIDATION: unknown timezone %', new.timezone using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Build a handle base from an email local part: lowercase [a-z0-9_], 3–15 chars.
create or replace function public.handle_base_from_email(p_email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  -- rpad() also truncates, so only pad when shorter than 3.
  with b as (
    select left(
      coalesce(nullif(regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), ''), 'user'),
      15
    ) as v
  )
  select case when char_length(v) < 3 then rpad(v, 3, '0') else v end from b;
$$;

-- AFTER INSERT on auth.users → create the profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_base text := public.handle_base_from_email(new.email);
  v_handle text;
  v_avatar text;
  v_attempt int := 0;
begin
  v_name := left(btrim(coalesce(
    nullif(btrim(v_meta ->> 'full_name'), ''),
    nullif(btrim(v_meta ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'TeamSync user'
  )), 80);

  v_avatar := coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture');
  if v_avatar is not null and v_avatar !~ '^https?://' then
    v_avatar := null;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_handle := v_base || '_' || lpad((floor(random() * 10000))::int::text, 4, '0');
    begin
      insert into public.profiles (id, full_name, handle, avatar_url)
      values (new.id, v_name, v_handle, v_avatar);
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: SELECT policy is added in p1_rls_helpers (needs workspace_members).
alter table public.profiles enable row level security;

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level protection. Table-level UPDATE would override column revokes, so revoke it and
-- grant UPDATE only on user-editable columns (id, created_at, onboarded_at, last_workspace_id
-- stay immutable for clients; the latter two change through RPCs).
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;
grant update (
  full_name, handle, avatar_url, job_title, timezone, week_start, theme, reduced_motion,
  weekend_streak_protection, show_on_leaderboard, notification_prefs
) on public.profiles to authenticated;

-- Handle availability for the profile settings live check. Handles are global (used for
-- @mentions), but clients can only read profiles that share a workspace, so this runs as definer
-- and returns only a boolean.
create or replace function public.is_handle_available(p_handle text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if p_handle is null or p_handle !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles
     where handle = p_handle::extensions.citext and id <> auth.uid()
  );
end;
$$;

revoke all on function public.is_handle_available(text) from public, anon;
grant execute on function public.is_handle_available(text) to authenticated;
