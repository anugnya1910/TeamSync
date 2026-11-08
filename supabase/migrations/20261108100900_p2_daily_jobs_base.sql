-- Phase 2 · M9 daily jobs base + health check (spec §B.14, PHASE_2 M9)

-- due_soon: open tasks due on p_date + 1; overdue: open tasks whose due date was p_date - 1
-- (first overdue day only). Idempotent per date via notifications_due_dedup.
-- Service role only (called by /api/cron/daily).
create or replace function public.generate_due_notifications(p_date date)
returns table (due_soon int, overdue int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_soon int := 0;
  v_over int := 0;
begin
  with ins as (
    insert into public.notifications (user_id, workspace_id, type, title, body, link, entity_id)
    select ta.user_id, t.workspace_id, 'due_soon',
           left(pr.key || '-' || t.number || ' is due tomorrow', 140), left(t.title, 500),
           '/w/' || w.slug || '/t/' || pr.key || '-' || t.number, t.id
      from public.tasks t
      join public.projects pr on pr.id = t.project_id and pr.deleted_at is null and pr.status <> 'archived'
      join public.workspaces w on w.id = t.workspace_id and w.deleted_at is null
      join public.task_assignees ta on ta.task_id = t.id
      join public.profiles p on p.id = ta.user_id
     where t.deleted_at is null
       and t.status not in ('done', 'cancelled')
       and t.due_date = p_date + 1
       and coalesce(p.notification_prefs ->> 'due_soon', 'true') <> 'false'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_soon from ins;

  with ins as (
    insert into public.notifications (user_id, workspace_id, type, title, body, link, entity_id)
    select ta.user_id, t.workspace_id, 'overdue',
           left(pr.key || '-' || t.number || ' is overdue', 140), left(t.title, 500),
           '/w/' || w.slug || '/t/' || pr.key || '-' || t.number, t.id
      from public.tasks t
      join public.projects pr on pr.id = t.project_id and pr.deleted_at is null and pr.status <> 'archived'
      join public.workspaces w on w.id = t.workspace_id and w.deleted_at is null
      join public.task_assignees ta on ta.task_id = t.id
      join public.profiles p on p.id = ta.user_id
     where t.deleted_at is null
       and t.status not in ('done', 'cancelled')
       and t.due_date = p_date - 1
       and coalesce(p.notification_prefs ->> 'overdue', 'true') <> 'false'
    on conflict do nothing
    returning 1
  )
  select count(*) into v_over from ins;

  due_soon := v_soon;
  overdue := v_over;
  return next;
end;
$$;

revoke all on function public.generate_due_notifications(date) from public, anon, authenticated;
grant execute on function public.generate_due_notifications(date) to service_role;

-- Liveness probe for /api/health — returns only the server time.
create or replace function public.health_check()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select now();
$$;
revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated, service_role;
