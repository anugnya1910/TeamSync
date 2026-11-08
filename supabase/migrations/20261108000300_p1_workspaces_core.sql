-- Phase 1 · workspaces, membership, onboarding RPCs (spec §D.2 #2–3, §B.2, §B.3)

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  slug extensions.citext not null unique check (slug::text ~ '^[a-z0-9-]{3,40}$'),
  logo_url text check (logo_url is null or logo_url ~ '^https?://'),
  owner_id uuid not null references public.profiles (id),
  ai_enabled boolean not null default true,
  ai_daily_limit int not null default 100 check (ai_daily_limit between 0 and 1000),
  gamification_enabled boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_owner_idx on public.workspaces (owner_id);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);
-- Exactly one owner per workspace.
create unique index workspace_members_one_owner on public.workspace_members (workspace_id)
  where role = 'owner';

-- Owner row protection: the owner row cannot be deleted or demoted, and nobody else can be
-- promoted to owner, except by the ownership-transfer RPC (Phase 2) which sets
-- `teamsync.allow_owner_change` for its own transaction. Cascades from a deleted workspace are allowed.
create or replace function public.protect_workspace_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_bypass boolean := coalesce(current_setting('teamsync.allow_owner_change', true), '') = 'on';
begin
  if v_bypass then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'owner'
       and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'FORBIDDEN: the workspace owner cannot be removed; transfer ownership first'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      raise exception 'FORBIDDEN: the owner role can only change through ownership transfer'
        using errcode = '42501';
    end if;
    if new.role = 'owner' and old.role <> 'owner' then
      raise exception 'FORBIDDEN: use ownership transfer to assign a new owner'
        using errcode = '42501';
    end if;
    if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
      raise exception 'FORBIDDEN: membership keys are immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  -- INSERT: an owner row is only valid for the workspace's recorded owner.
  if new.role = 'owner'
     and not exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.owner_id = new.user_id) then
    raise exception 'FORBIDDEN: only the workspace owner may hold the owner role' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workspace_members_protect_owner
  before insert or update or delete on public.workspace_members
  for each row execute function public.protect_workspace_owner();

alter table public.profiles
  add constraint profiles_last_workspace_fk
  foreign key (last_workspace_id) references public.workspaces (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

create or replace function public.is_slug_available(p_slug text)
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
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,40}$' then
    return false;
  end if;
  return not exists (select 1 from public.workspaces where slug = p_slug::extensions.citext);
end;
$$;

create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 60 then
    raise exception 'VALIDATION: workspace name must be 2–60 characters' using errcode = '23514';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]{3,40}$' then
    raise exception 'VALIDATION: slug must be 3–40 lowercase letters, digits or hyphens' using errcode = '23514';
  end if;
  if exists (select 1 from public.workspaces where slug = p_slug::extensions.citext) then
    raise exception 'CONFLICT: that workspace URL is already taken';
  end if;

  begin
    insert into public.workspaces (name, slug, owner_id)
    values (btrim(p_name), p_slug, v_uid)
    returning * into v_ws;
  exception when unique_violation then
    raise exception 'CONFLICT: that workspace URL is already taken';
  end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_uid, 'owner');

  update public.profiles set last_workspace_id = v_ws.id where id = v_uid;

  return v_ws;
end;
$$;

create or replace function public.complete_onboarding(
  p_full_name text,
  p_job_title text,
  p_timezone text,
  p_avatar_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 80 then
    raise exception 'VALIDATION: full name must be 1–80 characters' using errcode = '23514';
  end if;

  update public.profiles
     set full_name = btrim(p_full_name),
         job_title = nullif(btrim(coalesce(p_job_title, '')), ''),
         timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), timezone),
         avatar_url = nullif(btrim(coalesce(p_avatar_url, '')), ''),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'NOT_FOUND: profile missing' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.set_last_workspace(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_members m
     where m.workspace_id = p_workspace and m.user_id = v_uid
  ) then
    update public.profiles set last_workspace_id = p_workspace
     where id = v_uid and last_workspace_id is distinct from p_workspace;
  end if;
end;
$$;

revoke all on function public.is_slug_available(text) from public, anon;
revoke all on function public.create_workspace(text, text) from public, anon;
revoke all on function public.complete_onboarding(text, text, text, text) from public, anon;
revoke all on function public.set_last_workspace(uuid) from public, anon;
grant execute on function public.is_slug_available(text) to authenticated;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.complete_onboarding(text, text, text, text) to authenticated;
grant execute on function public.set_last_workspace(uuid) to authenticated;
