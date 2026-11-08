-- Phase 1 · RLS helper functions and policies (spec §D.4, §D.5)

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
     where m.workspace_id = ws
       and m.user_id = (select auth.uid())
       and w.deleted_at is null
  );
$$;

create or replace function public.workspace_role_of(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
   where m.workspace_id = ws
     and m.user_id = (select auth.uid())
     and w.deleted_at is null;
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.workspace_role_of(ws) in ('owner', 'admin'), false);
$$;

-- True when `other` and the current user share at least one (non-deleted) workspace.
create or replace function public.shares_workspace_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      join public.workspaces w on w.id = mine.workspace_id
     where mine.user_id = (select auth.uid())
       and theirs.user_id = other
       and w.deleted_at is null
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.workspace_role_of(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.shares_workspace_with(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role_of(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy profiles_select_self_or_shared on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace_with(id));

create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

create policy workspaces_update_admin on public.workspaces
  for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Privileges: no direct INSERT/DELETE on workspaces or memberships (RPCs only); UPDATE on
-- workspaces limited to settings columns (id, owner_id, created_at, deleted_at are immutable for clients).
revoke insert, update, delete, truncate on public.workspaces from anon, authenticated;
revoke insert, update, delete, truncate on public.workspace_members from anon, authenticated;
revoke select on public.workspaces, public.workspace_members from anon;
grant select on public.workspaces, public.workspace_members to authenticated;
grant update (name, slug, logo_url, ai_enabled, ai_daily_limit, gamification_enabled)
  on public.workspaces to authenticated;
