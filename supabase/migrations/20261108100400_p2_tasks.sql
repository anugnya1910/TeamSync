-- Phase 2 · M4 tasks, assignees, labels, status history, move/bulk RPCs (spec §B.7–B.9, §D.2 #10–15)

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  number int not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 20000),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'none',
  effort_points smallint check (effort_points is null or effort_points in (1, 2, 3, 5, 8, 13)),
  start_date date,
  due_date date,
  is_blocked boolean not null default false,
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 300),
  position numeric not null,
  created_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  check (parent_task_id is null or parent_task_id <> id),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create index tasks_board_idx on public.tasks (project_id, status, position);
create index tasks_ws_due_idx on public.tasks (workspace_id, due_date) where deleted_at is null;
create index tasks_milestone_idx on public.tasks (milestone_id);
create index tasks_parent_idx on public.tasks (parent_task_id);
create index tasks_search_idx on public.tasks using gin (search_vector);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null,
  workspace_id uuid not null,
  assigned_by uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id, workspace_id);
create index task_assignees_project_idx on public.task_assignees (project_id);

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  project_id uuid not null,
  workspace_id uuid not null,
  primary key (task_id, label_id)
);
create index task_labels_project_idx on public.task_labels (project_id);

create table public.task_status_history (
  id bigserial primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null,
  workspace_id uuid not null,
  from_status public.task_status,
  to_status public.task_status not null,
  effort_points smallint,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index task_status_history_project_idx on public.task_status_history (project_id, changed_at);
create index task_status_history_task_idx on public.task_status_history (task_id, changed_at);

-- ---------------------------------------------------------------------------------------------
-- Extension points (Phase 3 replaces task_has_open_blockers with dependency-aware logic)
-- ---------------------------------------------------------------------------------------------

create or replace function public.task_has_open_blockers(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select false;
$$;

create or replace function public.task_effectively_blocked(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select is_blocked from public.tasks where id = p_task), false)
      or public.task_has_open_blockers(p_task);
$$;

create or replace function public.task_key(p_task uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.key || '-' || t.number from public.tasks t join public.projects pr on pr.id = t.project_id where t.id = p_task;
$$;

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

create or replace function public.tasks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects;
  v_parent public.tasks;
begin
  select * into v_project from public.projects where id = new.project_id for update;
  if v_project.id is null or v_project.deleted_at is not null then
    raise exception 'NOT_FOUND: project not found' using errcode = 'P0002';
  end if;

  new.workspace_id := v_project.workspace_id;
  update public.projects set task_counter = task_counter + 1 where id = v_project.id
    returning task_counter into new.number;
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.title := btrim(new.title);

  if new.parent_task_id is not null then
    select * into v_parent from public.tasks where id = new.parent_task_id;
    if v_parent.id is null or v_parent.project_id <> new.project_id or v_parent.deleted_at is not null then
      raise exception 'VALIDATION: parent task must be in the same project' using errcode = '23514';
    end if;
    if v_parent.parent_task_id is not null then
      raise exception 'VALIDATION: subtasks cannot have their own subtasks' using errcode = '23514';
    end if;
  end if;

  if new.milestone_id is not null
     and not exists (select 1 from public.milestones where id = new.milestone_id and project_id = new.project_id) then
    raise exception 'VALIDATION: milestone must belong to the same project' using errcode = '23514';
  end if;

  if new.position is null then
    select coalesce(max(position), 0) + 1024 into new.position
      from public.tasks where project_id = new.project_id and status = new.status;
  end if;

  new.completed_at := case when new.status = 'done' then now() else null end;
  new.deleted_at := null;
  return new;
end;
$$;

create trigger tasks_before_insert before insert on public.tasks
  for each row execute function public.tasks_before_insert();

create or replace function public.tasks_before_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_lead boolean;
  v_override text := nullif(current_setting('app.override_reason', true), '');
  v_parent public.tasks;
begin
  if new.project_id <> old.project_id or new.workspace_id <> old.workspace_id
     or new.number <> old.number or new.created_by is distinct from old.created_by then
    raise exception 'FORBIDDEN: project, number and creator of a task cannot change' using errcode = '42501';
  end if;

  v_is_lead := v_uid is null or public.is_project_lead(new.project_id);

  -- Soft delete / restore: lead, or the creator if they can still edit the project.
  if new.deleted_at is distinct from old.deleted_at and v_uid is not null then
    if not (v_is_lead or (old.created_by = v_uid and public.can_edit_project_content(new.project_id))) then
      raise exception 'FORBIDDEN: only the project lead or the task creator can delete this task' using errcode = '42501';
    end if;
  end if;

  if new.parent_task_id is distinct from old.parent_task_id and new.parent_task_id is not null then
    select * into v_parent from public.tasks where id = new.parent_task_id;
    if v_parent.id is null or v_parent.project_id <> new.project_id or v_parent.parent_task_id is not null
       or exists (select 1 from public.tasks where parent_task_id = new.id and deleted_at is null) then
      raise exception 'VALIDATION: invalid parent task (one level of subtasks, same project)' using errcode = '23514';
    end if;
  end if;

  if new.milestone_id is distinct from old.milestone_id and new.milestone_id is not null
     and not exists (select 1 from public.milestones where id = new.milestone_id and project_id = new.project_id) then
    raise exception 'VALIDATION: milestone must belong to the same project' using errcode = '23514';
  end if;

  if new.status = 'done' and old.status <> 'done' then
    if (new.is_blocked or public.task_has_open_blockers(new.id)) and not (v_is_lead and v_override is not null) then
      raise exception 'TASK_BLOCKED: this task is blocked — resolve the blocker first%',
        case when v_is_lead then ' or override with a reason' else '' end;
    end if;
    if exists (
      select 1 from public.tasks s
       where s.parent_task_id = new.id and s.deleted_at is null and s.status not in ('done', 'cancelled')
    ) and not (v_is_lead and v_override is not null) then
      raise exception 'SUBTASKS_OPEN: complete or cancel the open subtasks first%',
        case when v_is_lead then ' or override with a reason' else '' end;
    end if;
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  if not new.is_blocked then
    new.blocked_reason := null;
  end if;
  new.title := btrim(new.title);
  return new;
end;
$$;

create trigger tasks_before_update before update on public.tasks
  for each row execute function public.tasks_before_update();

-- History: initial status on insert, every status change afterwards (basis of burndown/throughput).
create or replace function public.tasks_record_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (task_id, project_id, workspace_id, from_status, to_status, effort_points, changed_by)
    values (new.id, new.project_id, new.workspace_id, null, new.status, new.effort_points, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.task_status_history (task_id, project_id, workspace_id, from_status, to_status, effort_points, changed_by)
    values (new.id, new.project_id, new.workspace_id, old.status, new.status, new.effort_points, auth.uid());
  end if;
  return null;
end;
$$;

create trigger tasks_status_history after insert or update of status on public.tasks
  for each row execute function public.tasks_record_status_history();

create or replace function public.task_assignees_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = new.task_id;
  if v_task.id is null or v_task.deleted_at is not null then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  new.project_id := v_task.project_id;
  new.workspace_id := v_task.workspace_id;
  new.assigned_by := coalesce(auth.uid(), new.assigned_by);
  if not exists (
    select 1 from public.project_members
     where project_id = v_task.project_id and user_id = new.user_id and role <> 'viewer'
  ) then
    raise exception 'VALIDATION: only project contributors and leads can be assigned' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger task_assignees_before_insert before insert on public.task_assignees
  for each row execute function public.task_assignees_before_insert();

create or replace function public.task_labels_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select project_id, workspace_id into new.project_id, new.workspace_id from public.tasks where id = new.task_id;
  if new.project_id is null then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.labels where id = new.label_id and project_id = new.project_id) then
    raise exception 'VALIDATION: label must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger task_labels_before_insert before insert on public.task_labels
  for each row execute function public.task_labels_before_insert();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_status_history enable row level security;

create policy tasks_select on public.tasks for select to authenticated
  using (deleted_at is null and public.can_view_project(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.can_edit_project_content(project_id) and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (deleted_at is null and public.can_edit_project_content(project_id))
  with check (public.can_edit_project_content(project_id));

create policy task_assignees_select on public.task_assignees for select to authenticated
  using (public.can_view_project(project_id));
create policy task_assignees_insert on public.task_assignees for insert to authenticated
  with check (public.can_edit_project_content(project_id));
create policy task_assignees_delete on public.task_assignees for delete to authenticated
  using (public.can_edit_project_content(project_id));

create policy task_labels_select on public.task_labels for select to authenticated
  using (public.can_view_project(project_id));
create policy task_labels_insert on public.task_labels for insert to authenticated
  with check (public.can_edit_project_content(project_id));
create policy task_labels_delete on public.task_labels for delete to authenticated
  using (public.can_edit_project_content(project_id));

create policy task_status_history_select on public.task_status_history for select to authenticated
  using (public.can_view_project(project_id));

revoke all on public.tasks, public.task_assignees, public.task_labels, public.task_status_history from anon;
revoke insert, update, delete, truncate on public.tasks from authenticated;
grant select on public.tasks to authenticated;
grant insert (id, project_id, milestone_id, parent_task_id, title, description, status, priority, effort_points,
              start_date, due_date, is_blocked, blocked_reason, position)
  on public.tasks to authenticated;
grant update (milestone_id, parent_task_id, title, description, status, priority, effort_points, start_date,
              due_date, is_blocked, blocked_reason, position)
  on public.tasks to authenticated;
revoke update, truncate on public.task_assignees, public.task_labels from authenticated;
grant select, insert, delete on public.task_assignees, public.task_labels to authenticated;
revoke insert, update, delete, truncate on public.task_status_history from authenticated;
grant select on public.task_status_history to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

create or replace function public.move_task(
  p_task uuid,
  p_status public.task_status,
  p_before numeric default null,
  p_after numeric default null,
  p_override_reason text default null,
  p_client_mutation_id text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_pos numeric;
  v_before_id uuid;
  v_after_id uuid;
begin
  select * into v_task from public.tasks where id = p_task and deleted_at is null for update;
  if v_task.id is null or not public.can_view_project(v_task.project_id) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_project_content(v_task.project_id) then
    raise exception 'FORBIDDEN: you have view-only access to this project' using errcode = '42501';
  end if;

  -- Serialise moves within the project so renormalisation is consistent.
  perform pg_advisory_xact_lock(hashtext('move_task:' || v_task.project_id::text));

  if p_before is not null and p_after is not null and p_after - p_before < 1e-9 then
    select id into v_before_id from public.tasks
     where project_id = v_task.project_id and status = p_status and position = p_before and id <> p_task limit 1;
    select id into v_after_id from public.tasks
     where project_id = v_task.project_id and status = p_status and position = p_after and id <> p_task limit 1;
    with ordered as (
      select id, row_number() over (order by position, created_at) as rn
        from public.tasks
       where project_id = v_task.project_id and status = p_status and id <> p_task
    )
    update public.tasks t set position = o.rn * 1024 from ordered o where t.id = o.id;
    select position into p_before from public.tasks where id = v_before_id;
    select position into p_after from public.tasks where id = v_after_id;
  end if;

  if p_before is not null and p_after is not null then
    v_pos := (p_before + p_after) / 2;
  elsif p_before is not null then
    v_pos := p_before + 1024;
  elsif p_after is not null then
    v_pos := p_after - 1024;
  else
    select coalesce(max(position), 0) + 1024 into v_pos
      from public.tasks where project_id = v_task.project_id and status = p_status and id <> p_task;
  end if;

  if p_override_reason is not null and btrim(p_override_reason) <> '' then
    if not public.is_project_lead(v_task.project_id) then
      raise exception 'FORBIDDEN: only project leads can override' using errcode = '42501';
    end if;
    perform set_config('app.override_reason', left(btrim(p_override_reason), 300), true);
  end if;
  if p_client_mutation_id is not null then
    perform set_config('app.client_mutation_id', left(p_client_mutation_id, 64), true);
  end if;

  update public.tasks set status = p_status, position = v_pos where id = p_task
  returning * into v_task;

  perform set_config('app.override_reason', '', true);
  return v_task;
end;
$$;

create or replace function public.set_task_assignees(p_task uuid, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.tasks where id = p_task and deleted_at is null;
  if v_project is null or not public.can_view_project(v_project) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_project_content(v_project) then
    raise exception 'FORBIDDEN: you have view-only access to this project' using errcode = '42501';
  end if;
  delete from public.task_assignees where task_id = p_task and not (user_id = any (coalesce(p_users, '{}')));
  insert into public.task_assignees (task_id, user_id)
  select p_task, u from unnest(coalesce(p_users, '{}')) as u
  on conflict do nothing;
end;
$$;

create or replace function public.set_task_labels(p_task uuid, p_labels uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.tasks where id = p_task and deleted_at is null;
  if v_project is null or not public.can_view_project(v_project) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_project_content(v_project) then
    raise exception 'FORBIDDEN: you have view-only access to this project' using errcode = '42501';
  end if;
  delete from public.task_labels where task_id = p_task and not (label_id = any (coalesce(p_labels, '{}')));
  insert into public.task_labels (task_id, label_id)
  select p_task, l from unnest(coalesce(p_labels, '{}')) as l
  on conflict do nothing;
end;
$$;

-- Applies a patch to many tasks; tasks the caller can't edit (or that violate a rule) are skipped.
create or replace function public.bulk_update_tasks(p_ids uuid[], p_patch jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_task public.tasks;
  v_count int := 0;
  v_key text;
begin
  for v_key in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if v_key not in ('status', 'priority', 'milestone_id', 'due_date', 'assignee_add', 'assignee_remove', 'delete') then
      raise exception 'VALIDATION: unsupported bulk field %', v_key using errcode = '23514';
    end if;
  end loop;
  if coalesce(array_length(p_ids, 1), 0) > 500 then
    raise exception 'VALIDATION: at most 500 tasks per bulk update' using errcode = '23514';
  end if;

  foreach v_id in array coalesce(p_ids, '{}') loop
    select * into v_task from public.tasks where id = v_id and deleted_at is null;
    continue when v_task.id is null or not public.can_edit_project_content(v_task.project_id);
    begin
      if p_patch ? 'delete' and (p_patch ->> 'delete')::boolean then
        update public.tasks set deleted_at = now() where id = v_id;
      else
        update public.tasks set
          status = case when p_patch ? 'status' then (p_patch ->> 'status')::public.task_status else status end,
          priority = case when p_patch ? 'priority' then (p_patch ->> 'priority')::public.task_priority else priority end,
          milestone_id = case when p_patch ? 'milestone_id' then nullif(p_patch ->> 'milestone_id', '')::uuid else milestone_id end,
          due_date = case when p_patch ? 'due_date' then nullif(p_patch ->> 'due_date', '')::date else due_date end
        where id = v_id;
        if p_patch ? 'assignee_add' then
          insert into public.task_assignees (task_id, user_id) values (v_id, (p_patch ->> 'assignee_add')::uuid)
          on conflict do nothing;
        end if;
        if p_patch ? 'assignee_remove' then
          delete from public.task_assignees where task_id = v_id and user_id = (p_patch ->> 'assignee_remove')::uuid;
        end if;
      end if;
      v_count := v_count + 1;
    exception
      when sqlstate 'P0001' or sqlstate '42501' or sqlstate '23514' then
        null; -- rule violation (e.g. TASK_BLOCKED, viewer assignee): skip this task
    end;
  end loop;
  return v_count;
end;
$$;

create or replace function public.delete_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task and deleted_at is null;
  if v_task.id is null or not public.can_view_project(v_task.project_id) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  update public.tasks set deleted_at = now() where id = p_task; -- permission enforced by trigger
end;
$$;

create or replace function public.restore_task(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task and deleted_at is not null;
  if v_task.id is null or not public.can_view_project(v_task.project_id) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  update public.tasks set deleted_at = null where id = p_task; -- permission enforced by trigger
end;
$$;

create or replace function public.duplicate_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_src public.tasks;
  v_new public.tasks;
begin
  select * into v_src from public.tasks where id = p_task and deleted_at is null;
  if v_src.id is null or not public.can_view_project(v_src.project_id) then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if not public.can_edit_project_content(v_src.project_id) then
    raise exception 'FORBIDDEN: you have view-only access to this project' using errcode = '42501';
  end if;
  insert into public.tasks (project_id, milestone_id, parent_task_id, title, description, status, priority, effort_points, start_date, due_date)
  values (v_src.project_id, v_src.milestone_id, v_src.parent_task_id, left(v_src.title || ' (copy)', 200), v_src.description,
          case when v_src.status in ('done', 'cancelled') then 'todo'::public.task_status else v_src.status end,
          v_src.priority, v_src.effort_points, v_src.start_date, v_src.due_date)
  returning * into v_new;
  insert into public.task_labels (task_id, label_id) select v_new.id, label_id from public.task_labels where task_id = p_task;
  return v_new;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.move_task(uuid, public.task_status, numeric, numeric, text, text)',
    'public.set_task_assignees(uuid, uuid[])',
    'public.set_task_labels(uuid, uuid[])',
    'public.bulk_update_tasks(uuid[], jsonb)',
    'public.delete_task(uuid)',
    'public.restore_task(uuid)',
    'public.duplicate_task(uuid)',
    'public.task_effectively_blocked(uuid)',
    'public.task_has_open_blockers(uuid)',
    'public.task_key(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
