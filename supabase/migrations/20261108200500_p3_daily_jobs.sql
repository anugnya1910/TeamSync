-- Phase 3 · M5 daily maintenance (keeps the free project well inside 500 MB, spec §M R4)

create or replace function public.prune_old_data()
returns table (activity_deleted int, notifications_deleted int, ai_requests_deleted int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare a int; n int; r int;
begin
  delete from public.activity_logs where created_at < now() - interval '180 days';
  get diagnostics a = row_count;
  delete from public.notifications where read_at is not null and created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  delete from public.ai_requests where created_at < now() - interval '180 days';
  get diagnostics r = row_count;
  activity_deleted := a; notifications_deleted := n; ai_requests_deleted := r;
  return next;
end;
$$;

revoke all on function public.prune_old_data() from public, anon, authenticated;
grant execute on function public.prune_old_data() to service_role;

-- Projects the daily job should snapshot (service role, paged).
create or replace function public.active_projects_page(p_after uuid, p_limit int default 50)
returns table (id uuid, workspace_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.workspace_id
    from public.projects p join public.workspaces w on w.id = p.workspace_id
   where p.deleted_at is null and p.status <> 'archived' and w.deleted_at is null
     and (p_after is null or p.id > p_after)
   order by p.id
   limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.active_projects_page(uuid, int) from public, anon, authenticated;
grant execute on function public.active_projects_page(uuid, int) to service_role;
