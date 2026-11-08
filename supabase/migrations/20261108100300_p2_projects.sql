-- Phase 2 · M3 projects, members, milestones, labels + project RLS helpers (spec §B.5–B.6, §D.2 #7–9, #12, §D.4)

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  key text not null check (key ~ '^[A-Z]{2,5}$'),
  description text check (description is null or char_length(description) <= 10000),
  icon text check (icon is null or char_length(icon) <= 16),
  color text not null default 'indigo' check (color ~ '^[a-z]{3,12}$'),
  status public.project_status not null default 'active',
  visibility public.project_visibility not null default 'workspace',
  start_date date,
  target_date date,
  task_counter int not null default 0,
  wip_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(wip_limits) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key),
  check (target_date is null or start_date is null or target_date >= start_date)
);

create index projects_ws_status_idx on public.projects (workspace_id, status);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null,
  role public.project_role not null default 'contributor',
  weekly_capacity_points int not null default 20 check (weekly_capacity_points between 0 and 200),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);
create index project_members_user_idx on public.project_members (user_id, workspace_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 2000),
  due_date date,
  status public.milestone_status not null default 'open',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_due_idx on public.milestones (project_id, due_date);
create trigger milestones_set_updated_at before update on public.milestones
  for each row execute function public.set_updated_at();

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null default 'slate' check (color ~ '^[a-z]{3,12}$'),
  unique (project_id, name)
);

-- Copy workspace_id from the parent project (never trusted from the client).
create or replace function public.copy_project_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select workspace_id into new.workspace_id from public.projects where id = new.project_id;
  if new.workspace_id is null then
    raise exception 'NOT_FOUND: project not found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger milestones_copy_ws before insert or update of project_id on public.milestones
  for each row execute function public.copy_project_workspace();
create trigger labels_copy_ws before insert or update of project_id on public.labels
  for each row execute function public.copy_project_workspace();

-- project_members: copy workspace, member must belong to the workspace, guests forced to viewer.
create or replace function public.project_members_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.workspace_role;
begin
  select workspace_id into new.workspace_id from public.projects where id = new.project_id;
  select role into v_role from public.workspace_members where workspace_id = new.workspace_id and user_id = new.user_id;
  if v_role is null then
    raise exception 'VALIDATION: project members must belong to the workspace' using errcode = '23514';
  end if;
  if v_role = 'guest' then
    new.role := 'viewer';
  end if;
  return new;
end;
$$;

create trigger project_members_before_write before insert or update on public.project_members
  for each row execute function public.project_members_before_write();

-- ---------------------------------------------------------------------------------------------
-- RLS helpers (§D.4)
-- ---------------------------------------------------------------------------------------------

create or replace function public.can_view_project(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.projects pr
      join public.workspaces w on w.id = pr.workspace_id and w.deleted_at is null
      join public.workspace_members wm on wm.workspace_id = pr.workspace_id and wm.user_id = (select auth.uid())
     where pr.id = p
       and pr.deleted_at is null
       and (
         wm.role in ('owner', 'admin')
         or (pr.visibility = 'workspace' and wm.role = 'member')
         or exists (select 1 from public.project_members pm where pm.project_id = pr.id and pm.user_id = wm.user_id)
       )
  );
$$;

create or replace function public.project_role_of(p uuid)
returns public.project_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
           when wm.role in ('owner', 'admin') then 'lead'::public.project_role
           else (select pm.role from public.project_members pm where pm.project_id = pr.id and pm.user_id = wm.user_id)
         end
    from public.projects pr
    join public.workspaces w on w.id = pr.workspace_id and w.deleted_at is null
    join public.workspace_members wm on wm.workspace_id = pr.workspace_id and wm.user_id = (select auth.uid())
   where pr.id = p;
$$;

create or replace function public.is_project_lead(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.project_role_of(p) = 'lead', false);
$$;

create or replace function public.can_edit_project_content(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.project_role_of(p) in ('lead', 'contributor'), false)
     and exists (select 1 from public.projects where id = p and status <> 'archived' and deleted_at is null);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.can_view_project(uuid)', 'public.project_role_of(uuid)',
    'public.is_project_lead(uuid)', 'public.can_edit_project_content(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Policies & privileges
-- ---------------------------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.labels enable row level security;

create policy projects_select on public.projects for select to authenticated
  using (public.can_view_project(id));
create policy projects_update on public.projects for update to authenticated
  using (public.is_project_lead(id)) with check (public.is_project_lead(id));

create policy project_members_select on public.project_members for select to authenticated
  using (public.can_view_project(project_id));

create policy milestones_select on public.milestones for select to authenticated
  using (public.can_view_project(project_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (public.is_project_lead(project_id));
create policy milestones_update on public.milestones for update to authenticated
  using (public.is_project_lead(project_id)) with check (public.is_project_lead(project_id));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.is_project_lead(project_id));

create policy labels_select on public.labels for select to authenticated
  using (public.can_view_project(project_id));
create policy labels_insert on public.labels for insert to authenticated
  with check (public.is_project_lead(project_id));
create policy labels_update on public.labels for update to authenticated
  using (public.is_project_lead(project_id)) with check (public.is_project_lead(project_id));
create policy labels_delete on public.labels for delete to authenticated
  using (public.is_project_lead(project_id));

revoke all on public.projects, public.project_members, public.milestones, public.labels from anon;
revoke insert, update, delete, truncate on public.projects from authenticated;
grant select on public.projects to authenticated;
grant update (name, description, icon, color, status, visibility, start_date, target_date, team_id, wip_limits)
  on public.projects to authenticated;
revoke insert, update, delete, truncate on public.project_members from authenticated;
grant select on public.project_members to authenticated;
revoke update, truncate on public.milestones, public.labels from authenticated;
grant select, insert, delete on public.milestones, public.labels to authenticated;
grant update (name, description, due_date, status, sort_order) on public.milestones to authenticated;
grant update (name, color) on public.labels to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Templates (titles only — no dates, no progress)
-- ---------------------------------------------------------------------------------------------

create or replace function public.project_template(p_template text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_template
    when 'college_project' then '[
      {"name":"Research","tasks":["Define the problem statement","Review existing literature","Collect requirements","Choose the tech stack"]},
      {"name":"Build","tasks":["Design the architecture","Set up the repository","Implement core features","Integrate the database"]},
      {"name":"Test","tasks":["Write the test plan","Run functional tests","Fix reported bugs","Collect user feedback"]},
      {"name":"Report","tasks":["Draft the project report","Prepare presentation slides","Record the demo video","Final review with guide"]}
    ]'::jsonb
    when 'event_planning' then '[
      {"name":"Plan","tasks":["Set goals and budget","Book the venue","Confirm speakers or performers","Create the schedule"]},
      {"name":"Promote","tasks":["Design posters","Publish social media posts","Open registrations"]},
      {"name":"Execute","tasks":["Arrange logistics","Brief volunteers","Run the event"]},
      {"name":"Wrap-up","tasks":["Collect feedback","Settle accounts","Share photos and thank-you notes"]}
    ]'::jsonb
    else '[]'::jsonb
  end;
$$;

create or replace function public.create_project(
  p_workspace uuid,
  p_name text,
  p_key text,
  p_description text default null,
  p_visibility public.project_visibility default 'workspace',
  p_start date default null,
  p_target date default null,
  p_team uuid default null,
  p_template text default 'blank',
  p_icon text default null,
  p_color text default 'indigo'
)
returns public.projects
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.workspace_role := public.workspace_role_of(p_workspace);
  v_project public.projects;
  v_milestone jsonb;
  v_ms_id uuid;
  v_title text;
  v_order int := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if v_role is null or v_role = 'guest' then
    raise exception 'FORBIDDEN: you cannot create projects in this workspace' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[A-Z]{2,5}$' then
    raise exception 'VALIDATION: key must be 2–5 uppercase letters' using errcode = '23514';
  end if;
  if p_template not in ('blank', 'college_project', 'event_planning') then
    raise exception 'VALIDATION: unknown template' using errcode = '23514';
  end if;
  if p_team is not null and not exists (select 1 from public.teams where id = p_team and workspace_id = p_workspace) then
    raise exception 'VALIDATION: team not found in this workspace' using errcode = '23514';
  end if;
  if exists (select 1 from public.projects where workspace_id = p_workspace and key = p_key) then
    raise exception 'CONFLICT: project key % is already used in this workspace', p_key;
  end if;

  insert into public.projects (workspace_id, team_id, name, key, description, icon, color, visibility, start_date, target_date, created_by)
  values (p_workspace, p_team, btrim(p_name), p_key, nullif(btrim(coalesce(p_description, '')), ''), nullif(p_icon, ''),
          coalesce(nullif(p_color, ''), 'indigo'), coalesce(p_visibility, 'workspace'), p_start, p_target, v_uid)
  returning * into v_project;

  insert into public.project_members (project_id, user_id, role) values (v_project.id, v_uid, 'lead');

  if p_team is not null then
    insert into public.project_members (project_id, user_id, role)
    select v_project.id, tm.user_id, 'contributor'
      from public.team_members tm
     where tm.team_id = p_team and tm.user_id <> v_uid
    on conflict do nothing;
  end if;

  for v_milestone in select * from jsonb_array_elements(public.project_template(p_template)) loop
    insert into public.milestones (project_id, name, sort_order)
    values (v_project.id, v_milestone ->> 'name', v_order)
    returning id into v_ms_id;
    for v_title in select jsonb_array_elements_text(v_milestone -> 'tasks') loop
      insert into public.tasks (project_id, milestone_id, title, status)
      values (v_project.id, v_ms_id, v_title, case when v_order = 0 then 'todo'::public.task_status else 'backlog'::public.task_status end);
    end loop;
    v_order := v_order + 1;
  end loop;

  select * into v_project from public.projects where id = v_project.id;
  return v_project;
end;
$$;

create or replace function public.is_project_key_available(p_workspace uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_workspace_member(p_workspace)
     and p_key ~ '^[A-Z]{2,5}$'
     and not exists (select 1 from public.projects where workspace_id = p_workspace and key = p_key);
$$;

create or replace function public.set_project_member(
  p_project uuid,
  p_user uuid,
  p_role public.project_role default 'contributor',
  p_capacity int default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_project_lead(p_project) then
    raise exception 'FORBIDDEN: only project leads can manage members' using errcode = '42501';
  end if;
  if p_capacity is not null and p_capacity not between 0 and 200 then
    raise exception 'VALIDATION: capacity must be between 0 and 200' using errcode = '23514';
  end if;
  insert into public.project_members (project_id, user_id, role, weekly_capacity_points)
  values (p_project, p_user, coalesce(p_role, 'contributor'), coalesce(p_capacity, 20))
  on conflict (project_id, user_id) do update
    set role = coalesce(p_role, project_members.role),
        weekly_capacity_points = coalesce(p_capacity, project_members.weekly_capacity_points);

  -- Viewers cannot hold assignments.
  if p_role = 'viewer' then
    delete from public.task_assignees ta using public.tasks t
     where ta.task_id = t.id and t.project_id = p_project and ta.user_id = p_user
       and t.status not in ('done', 'cancelled');
  end if;
end;
$$;

create or replace function public.remove_project_member(p_project uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_project_lead(p_project) or p_user = auth.uid()) then
    raise exception 'FORBIDDEN: only project leads can remove members' using errcode = '42501';
  end if;
  if not exists (select 1 from public.project_members where project_id = p_project and user_id = p_user) then
    raise exception 'NOT_FOUND: not a project member' using errcode = 'P0002';
  end if;
  delete from public.task_assignees ta using public.tasks t
   where ta.task_id = t.id and t.project_id = p_project and ta.user_id = p_user
     and t.status not in ('done', 'cancelled');
  delete from public.project_members where project_id = p_project and user_id = p_user;
end;
$$;

create or replace function public.set_project_archived(p_project uuid, p_archived boolean)
returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.projects;
begin
  if not public.is_project_lead(p_project) then
    raise exception 'FORBIDDEN: only project leads can archive projects' using errcode = '42501';
  end if;
  update public.projects
     set status = case when p_archived then 'archived'::public.project_status else 'active'::public.project_status end
   where id = p_project
  returning * into v;
  return v;
end;
$$;

-- Soft delete (30-day restore window by a lead; hard delete by the owner happens with the workspace).
create or replace function public.delete_project(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_project_lead(p_project) then
    raise exception 'FORBIDDEN: only project leads can delete projects' using errcode = '42501';
  end if;
  update public.projects set deleted_at = now() where id = p_project and deleted_at is null;
end;
$$;

create or replace function public.restore_project(p_project uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.projects;
  v_role public.workspace_role;
begin
  select * into v from public.projects where id = p_project;
  v_role := public.workspace_role_of(v.workspace_id);
  if v.id is null or v.deleted_at is null then
    raise exception 'NOT_FOUND: project not found' using errcode = 'P0002';
  end if;
  if not (v_role in ('owner', 'admin')
          or exists (select 1 from public.project_members where project_id = p_project and user_id = auth.uid() and role = 'lead')) then
    raise exception 'FORBIDDEN: only project leads can restore projects' using errcode = '42501';
  end if;
  if v.deleted_at < now() - interval '30 days' then
    raise exception 'VALIDATION: the 30-day restore window has passed' using errcode = '23514';
  end if;
  update public.projects set deleted_at = null where id = p_project;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_project(uuid, text, text, text, public.project_visibility, date, date, uuid, text, text, text)',
    'public.is_project_key_available(uuid, text)',
    'public.set_project_member(uuid, uuid, public.project_role, int)',
    'public.remove_project_member(uuid, uuid)',
    'public.set_project_archived(uuid, boolean)',
    'public.delete_project(uuid)',
    'public.restore_project(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
