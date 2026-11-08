-- Phase 2 · M2 teams (spec §B.4, §D.2 #5–6)

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'indigo' check (color ~ '^[a-z]{3,12}$'),
  icon text not null default 'users' check (icon ~ '^[a-z0-9-]{1,32}$'),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id),
  -- removing someone from the workspace removes their team memberships
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);

create index team_members_user_idx on public.team_members (user_id);
create index team_members_ws_idx on public.team_members (workspace_id);

create or replace function public.team_members_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select workspace_id into new.workspace_id from public.teams where id = new.team_id;
  if new.workspace_id is null then
    raise exception 'NOT_FOUND: team not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = new.user_id) then
    raise exception 'VALIDATION: team members must belong to the workspace' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger team_members_before_insert before insert on public.team_members
  for each row execute function public.team_members_before_insert();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy teams_select on public.teams for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.is_workspace_admin(workspace_id) and created_by = (select auth.uid()));
create policy teams_update on public.teams for update to authenticated
  using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy team_members_select on public.team_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

revoke all on public.teams, public.team_members from anon;
revoke update, truncate on public.teams from authenticated;
grant select, insert, delete on public.teams to authenticated;
grant update (name, color, icon) on public.teams to authenticated;
revoke update, truncate on public.team_members from authenticated;
grant select, insert, delete on public.team_members to authenticated;

-- Replace a team's member list in one call (admin).
create or replace function public.set_team_members(p_team uuid, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.teams where id = p_team;
  if v_ws is null or not public.is_workspace_admin(v_ws) then
    raise exception 'FORBIDDEN: only owners and admins can manage teams' using errcode = '42501';
  end if;
  delete from public.team_members where team_id = p_team and not (user_id = any (coalesce(p_users, '{}')));
  insert into public.team_members (team_id, user_id)
  select p_team, u from unnest(coalesce(p_users, '{}')) as u
  on conflict do nothing;
end;
$$;
revoke all on function public.set_team_members(uuid, uuid[]) from public, anon;
grant execute on function public.set_team_members(uuid, uuid[]) to authenticated;
