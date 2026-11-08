-- Phase 3 · M1 task dependencies, cycle prevention, effective-blocked (spec §B.12, §D.2 #14, §G.6)

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  blocker_task_id uuid not null references public.tasks (id) on delete cascade,
  blocked_task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (blocker_task_id, blocked_task_id),
  check (blocker_task_id <> blocked_task_id)
);
create index task_dependencies_blocker_idx on public.task_dependencies (blocker_task_id);
create index task_dependencies_blocked_idx on public.task_dependencies (blocked_task_id);
create index task_dependencies_project_idx on public.task_dependencies (project_id);

-- §G.6: validates and prevents cycles; serialised per project with an advisory lock.
create or replace function public.prevent_dependency_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocker public.tasks;
  v_blocked public.tasks;
  v_found boolean;
begin
  if new.blocker_task_id = new.blocked_task_id then
    raise exception 'CYCLE_DETECTED: a task cannot depend on itself';
  end if;
  select * into v_blocker from public.tasks where id = new.blocker_task_id;
  select * into v_blocked from public.tasks where id = new.blocked_task_id;
  if v_blocker.id is null or v_blocked.id is null then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if v_blocker.project_id <> v_blocked.project_id then
    raise exception 'VALIDATION: dependencies must be within one project' using errcode = '23514';
  end if;
  if v_blocker.deleted_at is not null or v_blocked.deleted_at is not null
     or v_blocker.status = 'cancelled' or v_blocked.status = 'cancelled' then
    raise exception 'VALIDATION: cannot link cancelled or deleted tasks' using errcode = '23514';
  end if;

  new.project_id := v_blocker.project_id;
  new.workspace_id := v_blocker.workspace_id;
  new.created_by := coalesce(auth.uid(), new.created_by);

  -- Serialise concurrent inserts in this project so two edges can't jointly form a cycle.
  perform pg_advisory_xact_lock(hashtext(new.project_id::text));

  -- Does a path blocked →…→ blocker already exist?
  with recursive reach(id, depth) as (
    select d.blocked_task_id, 1 from public.task_dependencies d where d.blocker_task_id = new.blocked_task_id
    union
    select d.blocked_task_id, r.depth + 1
      from public.task_dependencies d join reach r on d.blocker_task_id = r.id
     where r.depth < 500
  )
  select exists (select 1 from reach where id = new.blocker_task_id) into v_found;

  if v_found then
    raise exception 'CYCLE_DETECTED: %-% already (indirectly) blocks %-%',
      (select key from public.projects where id = v_blocked.project_id), v_blocked.number,
      (select key from public.projects where id = v_blocker.project_id), v_blocker.number;
  end if;
  return new;
end;
$$;

create trigger task_dependencies_prevent_cycle before insert on public.task_dependencies
  for each row execute function public.prevent_dependency_cycle();

-- Dependencies can't be edited in place (delete + insert instead).
create or replace function public.task_dependencies_no_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'VALIDATION: dependencies cannot be changed — remove and add instead' using errcode = '23514';
end;
$$;
create trigger task_dependencies_no_update before update on public.task_dependencies
  for each row execute function public.task_dependencies_no_update();

alter table public.task_dependencies enable row level security;
create policy task_dependencies_select on public.task_dependencies for select to authenticated
  using (public.can_view_project(project_id));
create policy task_dependencies_insert on public.task_dependencies for insert to authenticated
  with check (public.can_edit_project_content(project_id));
create policy task_dependencies_delete on public.task_dependencies for delete to authenticated
  using (public.can_edit_project_content(project_id));

revoke all on public.task_dependencies from anon;
revoke update, truncate on public.task_dependencies from authenticated;
grant select, insert, delete on public.task_dependencies to authenticated;

-- Effective-blocked hook (Phase 2 extension point) now includes open blockers.
create or replace function public.task_has_open_blockers(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.task_dependencies d
      join public.tasks b on b.id = d.blocker_task_id
     where d.blocked_task_id = p_task
       and b.deleted_at is null
       and b.status not in ('done', 'cancelled')
  );
$$;

create or replace view public.v_task_effective
with (security_invoker = true)
as
select
  t.*,
  coalesce(ob.cnt, 0)::int as open_blocker_count,
  (t.is_blocked or coalesce(ob.cnt, 0) > 0) as effectively_blocked,
  coalesce(bl.cnt, 0)::int as blocking_open_count
from public.tasks t
left join lateral (
  select count(*) as cnt
    from public.task_dependencies d join public.tasks b on b.id = d.blocker_task_id
   where d.blocked_task_id = t.id and b.deleted_at is null and b.status not in ('done', 'cancelled')
) ob on true
left join lateral (
  select count(*) as cnt
    from public.task_dependencies d join public.tasks x on x.id = d.blocked_task_id
   where d.blocker_task_id = t.id and x.deleted_at is null and x.status not in ('done', 'cancelled')
) bl on true;

revoke all on public.v_task_effective from anon;
grant select on public.v_task_effective to authenticated;

-- Activity for dependency add/remove.
create or replace function public.task_dependencies_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.task_dependencies := coalesce(new, old);
  v_key text := (select key from public.projects where id = v.project_id);
  v_blocker int := (select number from public.tasks where id = v.blocker_task_id);
  v_blocked int := (select number from public.tasks where id = v.blocked_task_id);
begin
  perform public.log_activity(v.workspace_id, v.project_id, v.blocked_task_id,
    case when tg_op = 'INSERT' then 'dependency.added' else 'dependency.removed' end, 'dependency', v.id,
    jsonb_build_object('key', v_key || '-' || v_blocked, 'blocker_key', v_key || '-' || v_blocker));
  return null;
end;
$$;
create trigger task_dependencies_activity after insert or delete on public.task_dependencies
  for each row execute function public.task_dependencies_activity();

alter publication supabase_realtime add table public.task_dependencies;
alter table public.task_dependencies replica identity full;
