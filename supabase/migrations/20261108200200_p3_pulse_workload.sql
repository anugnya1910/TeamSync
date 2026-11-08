-- Phase 3 · M2 Pulse snapshots & workload recommendations (spec §B.19, §B.21, §D.2 #22–23)

create table public.project_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  snapshot_date date not null,
  score smallint check (score is null or score between 0 and 100),
  band text not null check (band in ('healthy', 'watch', 'at_risk', 'critical', 'insufficient_data')),
  factors jsonb not null default '[]'::jsonb check (jsonb_typeof(factors) = 'array'),
  open_tasks int not null default 0,
  overdue_tasks int not null default 0,
  blocked_tasks int not null default 0,
  remaining_effort int not null default 0,
  completed_effort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, snapshot_date)
);
create index project_health_snapshots_ws_idx on public.project_health_snapshots (workspace_id, snapshot_date);

create table public.workload_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) <= 600),
  imbalance_before numeric not null,
  imbalance_after numeric not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'applied', 'dismissed', 'stale')),
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz
);
create index workload_recommendations_project_idx on public.workload_recommendations (project_id, status, created_at desc);
create index workload_recommendations_task_idx on public.workload_recommendations (task_id, created_at desc);

alter table public.project_health_snapshots enable row level security;
alter table public.workload_recommendations enable row level security;
create policy snapshots_select on public.project_health_snapshots for select to authenticated using (public.can_view_project(project_id));
create policy recommendations_select on public.workload_recommendations for select to authenticated using (public.can_view_project(project_id));
revoke all on public.project_health_snapshots, public.workload_recommendations from anon;
revoke insert, update, delete, truncate on public.project_health_snapshots, public.workload_recommendations from authenticated;
grant select on public.project_health_snapshots, public.workload_recommendations to authenticated;

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.role(), current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin') and auth.uid() is null;
$$;

-- Snapshot upsert: cron (service role) or any viewer of the project (lazy snapshot for "today").
create or replace function public.upsert_health_snapshot(
  p_project uuid,
  p_date date,
  p_score smallint,
  p_band text,
  p_factors jsonb,
  p_stats jsonb
)
returns public.project_health_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_sum numeric;
  v public.project_health_snapshots;
begin
  if not (public.is_service_role() or public.can_view_project(p_project)) then
    raise exception 'NOT_FOUND: project not found' using errcode = 'P0002';
  end if;
  if not public.is_service_role() and abs(p_date - current_date) > 1 then
    raise exception 'VALIDATION: snapshots can only be recorded for today' using errcode = '23514';
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'VALIDATION: score must be between 0 and 100' using errcode = '23514';
  end if;
  if p_band not in ('healthy', 'watch', 'at_risk', 'critical', 'insufficient_data') then
    raise exception 'VALIDATION: unknown band' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_factors, '[]'::jsonb)) <> 'array' then
    raise exception 'VALIDATION: factors must be an array' using errcode = '23514';
  end if;
  if p_score is not null then
    select coalesce(sum((f ->> 'points')::numeric), 0) into v_sum from jsonb_array_elements(p_factors) f;
    if abs(v_sum - p_score) > 1 then
      raise exception 'VALIDATION: factor points (%) do not add up to the score (%)', round(v_sum, 2), p_score using errcode = '23514';
    end if;
  elsif jsonb_array_length(p_factors) > 0 then
    raise exception 'VALIDATION: insufficient-data snapshots have no factors' using errcode = '23514';
  end if;

  select workspace_id into v_ws from public.projects where id = p_project;
  insert into public.project_health_snapshots
    (project_id, workspace_id, snapshot_date, score, band, factors, open_tasks, overdue_tasks, blocked_tasks, remaining_effort, completed_effort)
  values (
    p_project, v_ws, p_date, p_score, p_band, coalesce(p_factors, '[]'::jsonb),
    coalesce((p_stats ->> 'open_tasks')::int, 0), coalesce((p_stats ->> 'overdue_tasks')::int, 0),
    coalesce((p_stats ->> 'blocked_tasks')::int, 0), coalesce((p_stats ->> 'remaining_effort')::int, 0),
    coalesce((p_stats ->> 'completed_effort')::int, 0)
  )
  on conflict (project_id, snapshot_date) do update
    set score = excluded.score, band = excluded.band, factors = excluded.factors,
        open_tasks = excluded.open_tasks, overdue_tasks = excluded.overdue_tasks, blocked_tasks = excluded.blocked_tasks,
        remaining_effort = excluded.remaining_effort, completed_effort = excluded.completed_effort, updated_at = now()
    -- Past days are immutable: only a row created today may be refreshed.
    where project_health_snapshots.created_at::date = current_date
  returning * into v;
  if v.id is null then
    select * into v from public.project_health_snapshots where project_id = p_project and snapshot_date = p_date;
  end if;
  return v;
end;
$$;

create or replace function public.save_workload_recommendations(p_project uuid, p_items jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ws uuid;
  v_item jsonb;
  v_count int := 0;
begin
  if not (public.is_service_role() or public.is_project_lead(p_project)) then
    raise exception 'FORBIDDEN: only project leads can refresh suggestions' using errcode = '42501';
  end if;
  select workspace_id into v_ws from public.projects where id = p_project;
  update public.workload_recommendations set status = 'stale', resolved_at = now()
   where project_id = p_project and status = 'open';
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if not exists (select 1 from public.tasks where id = (v_item ->> 'task_id')::uuid and project_id = p_project and deleted_at is null) then
      continue;
    end if;
    insert into public.workload_recommendations
      (project_id, workspace_id, task_id, from_user_id, to_user_id, reason, imbalance_before, imbalance_after, details)
    values (
      p_project, v_ws, (v_item ->> 'task_id')::uuid, (v_item ->> 'from_user_id')::uuid, (v_item ->> 'to_user_id')::uuid,
      left(v_item ->> 'reason', 600), (v_item ->> 'imbalance_before')::numeric, (v_item ->> 'imbalance_after')::numeric,
      coalesce(v_item -> 'details', '{}'::jsonb)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Atomic, stale-safe apply. Returns the task, or NULL when the suggestion went stale
-- (the row is then marked `stale`; raising would roll that back, so the action maps NULL → CONFLICT).
create or replace function public.apply_workload_recommendation(p_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.workload_recommendations;
  t public.tasks;
  v_from text;
  v_to text;
  v_key text;
begin
  select * into r from public.workload_recommendations where id = p_id for update;
  if r.id is null or not public.can_view_project(r.project_id) then
    raise exception 'NOT_FOUND: suggestion not found' using errcode = 'P0002';
  end if;
  if not public.is_project_lead(r.project_id) then
    raise exception 'FORBIDDEN: only project leads can apply suggestions' using errcode = '42501';
  end if;
  if r.status <> 'open' then
    raise exception 'CONFLICT: this suggestion was already %', r.status;
  end if;

  select * into t from public.tasks where id = r.task_id for update;
  if t.id is null or t.deleted_at is not null or t.status not in ('todo', 'backlog')
     or (select array_agg(user_id) from public.task_assignees where task_id = t.id) is distinct from array[r.from_user_id]
     or not exists (select 1 from public.project_members where project_id = r.project_id and user_id = r.to_user_id and role in ('lead', 'contributor')) then
    update public.workload_recommendations set status = 'stale', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
    return null;
  end if;

  delete from public.task_assignees where task_id = t.id and user_id = r.from_user_id;
  insert into public.task_assignees (task_id, user_id) values (t.id, r.to_user_id);
  update public.workload_recommendations set status = 'applied', resolved_at = now(), resolved_by = auth.uid() where id = p_id;

  v_key := (select key from public.projects where id = t.project_id) || '-' || t.number;
  v_from := (select full_name from public.profiles where id = r.from_user_id);
  v_to := (select full_name from public.profiles where id = r.to_user_id);
  perform public.log_activity(t.workspace_id, t.project_id, t.id, 'rebalance.applied', 'task', t.id,
    jsonb_build_object('key', v_key, 'title', t.title, 'from_name', v_from, 'to_name', v_to));
  perform public.notify(r.from_user_id, t.workspace_id, 'rebalance_suggested',
    'Workload rebalanced: ' || v_key || ' moved to ' || v_to, t.title, public.task_link(t.id), t.id);
  perform public.notify(r.to_user_id, t.workspace_id, 'rebalance_suggested',
    'Workload rebalanced: you now own ' || v_key, t.title, public.task_link(t.id), t.id);
  return t;
end;
$$;

create or replace function public.dismiss_workload_recommendation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.workload_recommendations;
begin
  select * into r from public.workload_recommendations where id = p_id;
  if r.id is null or not public.is_project_lead(r.project_id) then
    raise exception 'FORBIDDEN: only project leads can dismiss suggestions' using errcode = '42501';
  end if;
  update public.workload_recommendations set status = 'dismissed', resolved_at = now(), resolved_by = auth.uid()
   where id = p_id and status = 'open';
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.upsert_health_snapshot(uuid, date, smallint, text, jsonb, jsonb)',
    'public.save_workload_recommendations(uuid, jsonb)',
    'public.apply_workload_recommendation(uuid)',
    'public.dismiss_workload_recommendation(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
revoke all on function public.is_service_role() from public, anon;
grant execute on function public.is_service_role() to authenticated, service_role;
