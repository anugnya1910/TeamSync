-- Phase 3 · M3 gamification: XP, levels, streaks, achievements, leaderboard (spec §B.23, §G.3, §G.4)
-- All awards happen in triggers; clients have no write access to any of these tables.

create table public.xp_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null check (source_type in ('task', 'comment', 'achievement', 'review')),
  source_id uuid not null,
  event_type text not null,
  xp int not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, event_type)
);
create index xp_events_ws_idx on public.xp_events (workspace_id, created_at);
create index xp_events_user_idx on public.xp_events (user_id, workspace_id, created_at);

create table public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  xp_reward int not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  achievement_code text not null references public.achievements (code),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, workspace_id, achievement_code)
);

create table public.user_streaks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
  primary key (user_id, workspace_id)
);

-- Reference data (catalogue from §B.23 — not metrics).
insert into public.achievements (code, name, description, icon, xp_reward) values
  ('first_task', 'First Blood', 'Complete your first task', 'flag', 10),
  ('ten_tasks', 'Momentum', 'Complete 10 tasks', 'trending-up', 25),
  ('fifty_tasks', 'Machine', 'Complete 50 tasks', 'cpu', 100),
  ('on_time_10', 'Punctual', 'Complete 10 tasks on or before their due date', 'clock', 50),
  ('streak_7', 'On Fire', 'Keep a 7-day streak', 'flame', 30),
  ('streak_30', 'Unstoppable', 'Keep a 30-day streak', 'zap', 150),
  ('unblocker', 'Unblocker', 'Complete a task that was blocking 2 or more open tasks', 'unlock', 25),
  ('helper', 'Team Player', 'Comment 25 times on teammates'' tasks', 'message-circle', 30),
  ('rescuer', 'Rescuer', 'Accept a rebalance reassignment and complete it', 'life-buoy', 40),
  ('milestone_closer', 'Closer', 'Complete the last open task of a milestone', 'diamond', 30)
on conflict (code) do nothing;

alter table public.xp_events enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_streaks enable row level security;
create policy xp_events_select on public.xp_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy achievements_select on public.achievements for select to authenticated using (true);
create policy user_achievements_select on public.user_achievements for select to authenticated using (public.is_workspace_member(workspace_id));
create policy user_streaks_select on public.user_streaks for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.xp_events, public.achievements, public.user_achievements, public.user_streaks from anon;
revoke insert, update, delete, truncate on public.xp_events, public.achievements, public.user_achievements, public.user_streaks from authenticated;
grant select on public.xp_events, public.achievements, public.user_achievements, public.user_streaks to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create or replace function public.level_for_xp(p_xp int)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select floor(sqrt(greatest(coalesce(p_xp, 0), 0) / 50.0))::int + 1;
$$;

create or replace function public.user_local_date(p_user uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = p_user), 'Asia/Kolkata'))::date;
$$;

create or replace function public.gamification_on(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select gamification_enabled and deleted_at is null from public.workspaces where id = p_workspace), false);
$$;

-- Inserts an XP event honouring the 500/day cap; returns XP actually awarded (0 on duplicates).
create or replace function public.insert_xp(
  p_workspace uuid, p_user uuid, p_source_type text, p_source uuid, p_event text, p_xp int, p_meta jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.user_local_date(p_user);
  v_tz text := coalesce((select timezone from public.profiles where id = p_user), 'Asia/Kolkata');
  v_earned int;
  v_award int := p_xp;
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_id bigint;
begin
  if p_user is null then return 0; end if;
  if p_xp > 0 then
    select coalesce(sum(xp), 0) into v_earned
      from public.xp_events
     where user_id = p_user and workspace_id = p_workspace and xp > 0
       and (created_at at time zone v_tz)::date = v_today;
    if v_earned + p_xp > 500 then
      v_award := greatest(0, 500 - v_earned);
      v_meta := v_meta || jsonb_build_object('capped', true, 'requested', p_xp);
    end if;
  end if;
  insert into public.xp_events (workspace_id, user_id, source_type, source_id, event_type, xp, metadata)
  values (p_workspace, p_user, p_source_type, p_source, p_event, v_award, v_meta)
  on conflict (user_id, source_type, source_id, event_type) do nothing
  returning id into v_id;
  return case when v_id is null then 0 else v_award end;
end;
$$;

-- §G.4 streak update on a qualifying activity (user's local date, weekend protection).
create or replace function public.update_streak(p_user uuid, p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_d date := public.user_local_date(p_user);
  v_protect boolean := coalesce((select weekend_streak_protection from public.profiles where id = p_user), true);
  s public.user_streaks;
  v_gap int;
  v_new int;
  v_weekend_only boolean;
begin
  if p_user is null or not public.gamification_on(p_workspace) then return; end if;
  insert into public.user_streaks (user_id, workspace_id) values (p_user, p_workspace) on conflict do nothing;
  select * into s from public.user_streaks where user_id = p_user and workspace_id = p_workspace for update;
  if s.last_active_date = v_d then return; end if;
  if s.last_active_date is null then
    v_new := 1;
  else
    v_gap := v_d - s.last_active_date;
    if v_gap <= 0 then return; end if;
    if v_gap = 1 then
      v_new := s.current_streak + 1;
    else
      select bool_and(extract(isodow from d) in (6, 7)) into v_weekend_only
        from generate_series(s.last_active_date + 1, v_d - 1, interval '1 day') as g(d);
      v_new := case when v_protect and coalesce(v_weekend_only, false) then s.current_streak + 1 else 1 end;
    end if;
  end if;
  update public.user_streaks
     set current_streak = v_new, longest_streak = greatest(longest_streak, v_new), last_active_date = v_d
   where user_id = p_user and workspace_id = p_workspace;
end;
$$;

-- Evaluates §B.23 rules; unlocks once, awards xp_reward, sends achievement_unlocked.
create or replace function public.check_achievements(p_user uuid, p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_completed int;
  v_on_time int;
  v_comments int;
  v_streak int;
  a public.achievements;
  v_earned boolean;
  v_slug text;
  v_prefs jsonb;
begin
  if p_user is null or not public.gamification_on(p_workspace) then return; end if;

  select count(distinct e.source_id) into v_completed
    from public.xp_events e
   where e.user_id = p_user and e.workspace_id = p_workspace and e.source_type = 'task'
     and e.event_type like 'task_completed:%'
     and not exists (select 1 from public.xp_events r where r.user_id = e.user_id and r.source_id = e.source_id
                     and r.event_type = 'task_reopened:' || split_part(e.event_type, ':', 2))
     and exists (select 1 from public.tasks t where t.id = e.source_id and t.status = 'done');
  select count(distinct source_id) into v_on_time
    from public.xp_events where user_id = p_user and workspace_id = p_workspace
     and event_type like 'task_completed:%' and metadata ->> 'on_time' = 'true';
  select count(*) into v_comments
    from public.xp_events where user_id = p_user and workspace_id = p_workspace and source_type = 'comment';
  select greatest(current_streak, longest_streak) into v_streak
    from public.user_streaks where user_id = p_user and workspace_id = p_workspace;

  for a in select * from public.achievements loop
    v_earned := case a.code
      when 'first_task' then v_completed >= 1
      when 'ten_tasks' then v_completed >= 10
      when 'fifty_tasks' then v_completed >= 50
      when 'on_time_10' then v_on_time >= 10
      when 'streak_7' then coalesce(v_streak, 0) >= 7
      when 'streak_30' then coalesce(v_streak, 0) >= 30
      when 'unblocker' then exists (select 1 from public.xp_events where user_id = p_user and workspace_id = p_workspace
                                     and (metadata ->> 'unblocked')::int >= 2)
      when 'helper' then v_comments >= 25
      when 'rescuer' then exists (select 1 from public.workload_recommendations w join public.tasks t on t.id = w.task_id
                                   where w.to_user_id = p_user and w.workspace_id = p_workspace and w.status = 'applied' and t.status = 'done')
      when 'milestone_closer' then exists (select 1 from public.xp_events where user_id = p_user and workspace_id = p_workspace
                                            and metadata ->> 'milestone_closer' = 'true')
      else false
    end;
    continue when not v_earned;
    insert into public.user_achievements (user_id, workspace_id, achievement_code)
    values (p_user, p_workspace, a.code)
    on conflict do nothing;
    if found then
      perform public.insert_xp(p_workspace, p_user, 'achievement', p_workspace, 'achievement:' || a.code, a.xp_reward,
                               jsonb_build_object('code', a.code));
      select slug::text into v_slug from public.workspaces where id = p_workspace;
      select notification_prefs into v_prefs from public.profiles where id = p_user;
      if coalesce(v_prefs ->> 'achievement_unlocked', 'true') <> 'false' then
        insert into public.notifications (user_id, workspace_id, type, title, body, link, entity_id)
        values (p_user, p_workspace, 'achievement_unlocked', 'Achievement unlocked: ' || a.name, a.description,
                '/w/' || v_slug || '/leaderboard', null);
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Award triggers
-- ---------------------------------------------------------------------------------------------

-- Runs after tasks_status_history (trigger names sort alphabetically), so the current completion
-- is already counted when computing the cycle number n.
create or replace function public.award_task_xp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_tz text;
  v_n int;
  v_base int;
  v_effort int := coalesce(new.effort_points, 1);
  v_timing numeric;
  v_done_date date;
  v_unblocked int;
  v_total int;
  v_each int;
  v_assignees uuid[];
  v_u uuid;
  v_trivial boolean;
  v_closer boolean;
  v_meta jsonb;
  r record;
begin
  if new.status is not distinct from old.status or not public.gamification_on(new.workspace_id) then
    return null;
  end if;

  -- Moving own task to review counts for the streak.
  if new.status = 'in_review' and v_actor is not null
     and exists (select 1 from public.task_assignees where task_id = new.id and user_id = v_actor) then
    perform public.update_streak(v_actor, new.workspace_id);
    perform public.check_achievements(v_actor, new.workspace_id);
  end if;

  if new.status = 'done' and old.status <> 'done' then
    select count(*) into v_n from public.task_status_history where task_id = new.id and to_status = 'done';
    v_n := greatest(v_n, 1);
    select array_agg(user_id order by user_id) into v_assignees from public.task_assignees where task_id = new.id;
    if v_assignees is null then
      v_assignees := case when v_actor is null then '{}'::uuid[] else array[v_actor] end;
    end if;

    v_trivial := new.created_by = v_actor and new.completed_at - new.created_at < interval '5 minutes' and v_effort <= 1;
    v_tz := coalesce((select timezone from public.profiles where id = coalesce(v_actor, v_assignees[1])), 'Asia/Kolkata');
    v_done_date := (coalesce(new.completed_at, now()) at time zone v_tz)::date;
    v_base := case new.priority when 'urgent' then 50 when 'high' then 35 when 'medium' then 20 else 10 end;
    v_timing := case
      when new.due_date is null then 1.0
      when v_done_date <= new.due_date then 1.25
      when v_done_date <= new.due_date + 2 then 1.0
      else 0.6 end;
    select count(*) into v_unblocked
      from public.task_dependencies d join public.tasks x on x.id = d.blocked_task_id
     where d.blocker_task_id = new.id and x.deleted_at is null and x.status not in ('done', 'cancelled');
    v_total := round(v_base * (1 + 0.1 * least(v_effort, 8)) * v_timing) + 10 * least(v_unblocked, 3);
    v_each := ceil(v_total::numeric / greatest(array_length(v_assignees, 1), 1));
    v_closer := new.milestone_id is not null and not exists (
      select 1 from public.tasks o where o.milestone_id = new.milestone_id and o.id <> new.id
         and o.deleted_at is null and o.status not in ('done', 'cancelled'));
    v_meta := jsonb_build_object('cycle', v_n, 'on_time', new.due_date is not null and v_done_date <= new.due_date,
                                 'unblocked', v_unblocked, 'milestone_closer', v_closer);

    foreach v_u in array v_assignees loop
      if v_trivial then
        perform public.insert_xp(new.workspace_id, v_u, 'task', new.id, 'task_completed_trivial:' || v_n, 0, v_meta);
      else
        perform public.insert_xp(new.workspace_id, v_u, 'task', new.id, 'task_completed:' || v_n, v_each, v_meta);
      end if;
    end loop;

    -- Review XP: in_review → done by someone who is not an assignee.
    if old.status = 'in_review' and v_actor is not null
       and not exists (select 1 from public.task_assignees where task_id = new.id and user_id = v_actor) then
      perform public.insert_xp(new.workspace_id, v_actor, 'review', new.id, 'review:' || v_n, 5, jsonb_build_object('cycle', v_n));
    end if;

    if v_actor is not null then perform public.update_streak(v_actor, new.workspace_id); end if;
    foreach v_u in array v_assignees loop
      perform public.check_achievements(v_u, new.workspace_id);
    end loop;
    if v_actor is not null and not (v_actor = any (v_assignees)) then
      perform public.check_achievements(v_actor, new.workspace_id);
    end if;

  elsif old.status = 'done' and new.status <> 'done' then
    -- Reopened: compensate this completion cycle's awards (idempotent per cycle).
    select count(*) into v_n from public.task_status_history where task_id = new.id and to_status = 'done';
    for r in
      select user_id, source_type, xp, event_type from public.xp_events
       where source_id = new.id and source_type in ('task', 'review')
         and event_type in ('task_completed:' || v_n, 'review:' || v_n) and xp > 0
    loop
      insert into public.xp_events (workspace_id, user_id, source_type, source_id, event_type, xp, metadata)
      values (new.workspace_id, r.user_id, r.source_type, new.id,
              case when r.source_type = 'review' then 'review_reopened:' else 'task_reopened:' end || v_n, -r.xp,
              jsonb_build_object('cycle', v_n))
      on conflict do nothing;
    end loop;
  end if;
  return null;
end;
$$;

create trigger tasks_xp_award after update of status on public.tasks
  for each row execute function public.award_task_xp();

create or replace function public.award_comment_xp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_today date;
  v_tz text;
  v_counted int;
begin
  if new.author_id is null or not public.gamification_on(new.workspace_id) then return null; end if;
  select * into v_task from public.tasks where id = new.task_id;
  -- Streak: commenting on a task in a project the author belongs to.
  if exists (select 1 from public.project_members where project_id = new.project_id and user_id = new.author_id) then
    perform public.update_streak(new.author_id, new.workspace_id);
  end if;
  -- +2 XP on someone else's task (not creator, not assignee), max 10 counted per day.
  if v_task.created_by is distinct from new.author_id
     and not exists (select 1 from public.task_assignees where task_id = new.task_id and user_id = new.author_id) then
    v_tz := coalesce((select timezone from public.profiles where id = new.author_id), 'Asia/Kolkata');
    v_today := (now() at time zone v_tz)::date;
    select count(*) into v_counted from public.xp_events
     where user_id = new.author_id and workspace_id = new.workspace_id and source_type = 'comment' and xp > 0
       and (created_at at time zone v_tz)::date = v_today;
    perform public.insert_xp(new.workspace_id, new.author_id, 'comment', new.id, 'comment',
                             case when v_counted < 10 then 2 else 0 end, '{}'::jsonb);
  end if;
  perform public.check_achievements(new.author_id, new.workspace_id);
  return null;
end;
$$;

create trigger comments_xp_award after insert on public.comments
  for each row execute function public.award_comment_xp();

-- ---------------------------------------------------------------------------------------------
-- Stats & leaderboard
-- ---------------------------------------------------------------------------------------------

create or replace view public.v_member_stats
with (security_invoker = true)
as
select
  m.workspace_id,
  m.user_id,
  coalesce(x.total_xp, 0)::int as total_xp,
  public.level_for_xp(coalesce(x.total_xp, 0)::int) as level,
  coalesce(x.tasks_completed, 0)::int as tasks_completed,
  coalesce(x.on_time_count, 0)::int as on_time_count,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(s.longest_streak, 0) as longest_streak
from public.workspace_members m
left join lateral (
  select sum(e.xp) as total_xp,
         count(distinct e.source_id) filter (where e.event_type like 'task_completed:%') as tasks_completed,
         count(distinct e.source_id) filter (where e.event_type like 'task_completed:%' and e.metadata ->> 'on_time' = 'true') as on_time_count
    from public.xp_events e where e.workspace_id = m.workspace_id and e.user_id = m.user_id
) x on true
left join public.user_streaks s on s.workspace_id = m.workspace_id and s.user_id = m.user_id;

revoke all on public.v_member_stats from anon;
grant select on public.v_member_stats to authenticated;

create or replace function public.get_leaderboard(p_workspace uuid, p_period text default 'week')
returns table (
  user_id uuid, full_name text, avatar_url text, xp int, level int, current_streak int,
  tasks_completed int, rank int, is_self boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_since timestamptz := case p_period when 'week' then now() - interval '7 days' when 'month' then now() - interval '30 days' else '-infinity'::timestamptz end;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'NOT_FOUND: workspace not found' using errcode = 'P0002';
  end if;
  if p_period not in ('week', 'month', 'all') then
    raise exception 'VALIDATION: period must be week, month or all' using errcode = '23514';
  end if;
  return query
  with base as (
    select m.user_id, p.full_name, p.avatar_url, p.show_on_leaderboard,
           coalesce((select sum(e.xp) from public.xp_events e where e.workspace_id = p_workspace and e.user_id = m.user_id and e.created_at >= v_since), 0)::int as xp,
           public.level_for_xp(coalesce((select sum(e.xp) from public.xp_events e where e.workspace_id = p_workspace and e.user_id = m.user_id), 0)::int) as level,
           coalesce(s.current_streak, 0) as current_streak,
           coalesce((select count(distinct e.source_id) from public.xp_events e where e.workspace_id = p_workspace and e.user_id = m.user_id
                      and e.event_type like 'task_completed:%' and e.created_at >= v_since), 0)::int as tasks_completed
      from public.workspace_members m
      join public.profiles p on p.id = m.user_id
      left join public.user_streaks s on s.workspace_id = p_workspace and s.user_id = m.user_id
     where m.workspace_id = p_workspace
  ), ranked as (
    select b.*, dense_rank() over (order by b.xp desc)::int as rnk
      from base b where b.show_on_leaderboard
  )
  select r.user_id, r.full_name, r.avatar_url, r.xp, r.level, r.current_streak, r.tasks_completed, r.rnk, r.user_id = auth.uid()
    from ranked r
  union all
  select b.user_id, b.full_name, b.avatar_url, b.xp, b.level, b.current_streak, b.tasks_completed, null::int, true
    from base b where b.user_id = auth.uid() and not b.show_on_leaderboard
  order by 8 nulls last, 4 desc;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.get_leaderboard(uuid, text)', 'public.level_for_xp(int)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.insert_xp(uuid, uuid, text, uuid, text, int, jsonb)', 'public.update_streak(uuid, uuid)',
    'public.check_achievements(uuid, uuid)', 'public.user_local_date(uuid)', 'public.gamification_on(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Workspace admins toggle gamification (column already granted for UPDATE in p1_rls_helpers).
alter publication supabase_realtime add table public.user_achievements;
