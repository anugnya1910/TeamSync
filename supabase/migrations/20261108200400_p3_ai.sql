-- Phase 3 · M4 AI request log & quotas (spec §B.22, §C.7, §D.2 #28, §H.1)
-- Days are counted in Asia/Kolkata (APP_DEFAULT_TZ default; the database has no env access).

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('breakdown', 'summary', 'plan_project', 'priorities', 'risks')),
  source text not null check (source in ('ai', 'fallback')),
  status text not null check (status in ('pending', 'ok', 'error', 'rate_limited', 'disabled', 'invalid_output', 'not_configured', 'timeout')),
  input_tokens int,
  output_tokens int,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index ai_requests_ws_idx on public.ai_requests (workspace_id, created_at);
create index ai_requests_user_idx on public.ai_requests (user_id, created_at);

alter table public.ai_requests enable row level security;
create policy ai_requests_select on public.ai_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.is_workspace_admin(workspace_id));
revoke all on public.ai_requests from anon;
revoke insert, update, delete, truncate on public.ai_requests from authenticated;
grant select on public.ai_requests to authenticated;

create or replace function public.ai_day_start()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata';
$$;

create or replace function public.consume_ai_quota(p_workspace uuid, p_action text)
returns table (allowed boolean, reason text, user_remaining int, workspace_remaining int, request_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ws public.workspaces;
  v_user_used int;
  v_ws_used int;
  v_id uuid;
  v_user_limit constant int := 20;
begin
  if v_uid is null or not public.is_workspace_member(p_workspace) then
    raise exception 'NOT_FOUND: workspace not found' using errcode = 'P0002';
  end if;
  select * into v_ws from public.workspaces where id = p_workspace;

  -- Serialise per user so parallel requests can't overshoot the quota.
  perform pg_advisory_xact_lock(hashtext('ai:' || v_uid::text));
  select count(*) into v_user_used from public.ai_requests where user_id = v_uid and source = 'ai' and created_at >= public.ai_day_start();
  select count(*) into v_ws_used from public.ai_requests where workspace_id = p_workspace and source = 'ai' and created_at >= public.ai_day_start();

  user_remaining := greatest(v_user_limit - v_user_used, 0);
  workspace_remaining := greatest(v_ws.ai_daily_limit - v_ws_used, 0);

  if not v_ws.ai_enabled then
    allowed := false; reason := 'disabled';
  elsif v_user_used >= v_user_limit then
    allowed := false; reason := 'user_limit';
  elsif v_ws_used >= v_ws.ai_daily_limit then
    allowed := false; reason := 'workspace_limit';
  else
    allowed := true; reason := null;
  end if;

  insert into public.ai_requests (workspace_id, user_id, action, source, status)
  values (p_workspace, v_uid, p_action,
          case when allowed then 'ai' else 'fallback' end,
          case when allowed then 'pending' when reason = 'disabled' then 'disabled' else 'rate_limited' end)
  returning id into v_id;
  request_id := v_id;
  if allowed then
    user_remaining := user_remaining - 1;
    workspace_remaining := workspace_remaining - 1;
  end if;
  return next;
end;
$$;

-- Logs a request that never asked for quota (e.g. no API key → deterministic fallback).
create or replace function public.log_ai_fallback(p_workspace uuid, p_action text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace) then
    raise exception 'NOT_FOUND: workspace not found' using errcode = 'P0002';
  end if;
  insert into public.ai_requests (workspace_id, user_id, action, source, status)
  values (p_workspace, auth.uid(), p_action, 'fallback', p_status) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.finish_ai_request(
  p_id uuid, p_source text, p_status text, p_in int, p_out int, p_latency int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ai_requests
     set source = p_source, status = p_status, input_tokens = p_in, output_tokens = p_out, latency_ms = p_latency
   where id = p_id and user_id = auth.uid();
end;
$$;

-- Global daily count of real AI calls (provider free-tier guard). Returns only a number.
create or replace function public.ai_requests_today_global()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.ai_requests where source = 'ai' and created_at >= public.ai_day_start();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.consume_ai_quota(uuid, text)', 'public.log_ai_fallback(uuid, text, text)',
    'public.finish_ai_request(uuid, text, text, int, int, int)', 'public.ai_requests_today_global()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Activity entry when a user applies an AI (or rules-based) suggestion (spec §B.15).
create or replace function public.log_ai_applied(p_project uuid, p_kind text, p_count int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_ws uuid;
begin
  if not public.can_edit_project_content(p_project) then
    raise exception 'FORBIDDEN: you cannot edit this project' using errcode = '42501';
  end if;
  if p_kind not in ('breakdown', 'plan_project', 'priorities') then
    raise exception 'VALIDATION: unknown suggestion kind' using errcode = '23514';
  end if;
  select workspace_id into v_ws from public.projects where id = p_project;
  perform public.log_activity(v_ws, p_project, null, 'ai.applied', 'project', p_project,
    jsonb_build_object('kind', p_kind, 'count', p_count, 'project_name', (select name from public.projects where id = p_project)));
end;
$$;
revoke all on function public.log_ai_applied(uuid, text, int) from public, anon;
grant execute on function public.log_ai_applied(uuid, text, int) to authenticated;
