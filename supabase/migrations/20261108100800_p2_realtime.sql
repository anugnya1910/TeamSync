-- Phase 2 · M8 realtime (spec §C.6). Realtime respects RLS for postgres_changes.
--
-- Replica identity:
--  * tasks keeps the DEFAULT (primary key) identity. PostgreSQL refuses UPDATEs on a published
--    table whose REPLICA IDENTITY FULL includes an unpublished generated column, and
--    tasks.search_vector is generated. Tasks are soft-deleted (UPDATE), so INSERT/UPDATE events
--    still carry the full new row including project_id for filtered subscriptions.
--  * task_assignees and comments use FULL so DELETE events include project_id (filterable).
--    Storage impact: WAL carries the whole old row for these small tables only.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table
  public.tasks,
  public.task_assignees,
  public.comments,
  public.notifications,
  public.activity_logs;

alter table public.task_assignees replica identity full;
alter table public.comments replica identity full;
