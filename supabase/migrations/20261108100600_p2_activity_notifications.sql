-- Phase 2 · M6 activity logs, notifications, saved views (spec §B.14–B.15, §B.17, §D.2 #19–21)

create table public.activity_logs (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_logs_project_idx on public.activity_logs (project_id, created_at desc);
create index activity_logs_ws_idx on public.activity_logs (workspace_id, created_at desc);
create index activity_logs_task_idx on public.activity_logs (task_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) <= 140),
  body text check (body is null or char_length(body) <= 500),
  link text,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create unique index notifications_due_dedup on public.notifications
  (user_id, type, entity_id, ((created_at at time zone 'UTC')::date))
  where type in ('due_soon', 'overdue');

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  view_type text not null check (view_type in ('board', 'list', 'calendar')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index saved_views_user_project_idx on public.saved_views (user_id, project_id);
create trigger saved_views_copy_ws before insert on public.saved_views
  for each row execute function public.copy_project_workspace();

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------------------------

create or replace function public.log_activity(
  p_workspace uuid, p_project uuid, p_task uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Skip when the parent is being hard-deleted (cascade) — the FK would fail.
  if not exists (select 1 from public.workspaces where id = p_workspace) then return; end if;
  if p_project is not null and not exists (select 1 from public.projects where id = p_project) then return; end if;
  if p_task is not null and not exists (select 1 from public.tasks where id = p_task) then p_task := null; end if;
  insert into public.activity_logs (workspace_id, project_id, task_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_workspace, p_project, p_task, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.notify(
  p_user uuid, p_workspace uuid, p_type public.notification_type, p_title text, p_body text, p_link text, p_entity uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefs jsonb;
begin
  if p_user is null or p_user = auth.uid() then return; end if;            -- never notify the actor
  if not exists (select 1 from public.workspaces where id = p_workspace and deleted_at is null) then return; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = p_workspace and user_id = p_user) then return; end if;
  select notification_prefs into v_prefs from public.profiles where id = p_user;
  if coalesce(v_prefs ->> p_type::text, 'true') = 'false' then return; end if;
  insert into public.notifications (user_id, workspace_id, type, title, body, link, actor_id, entity_id)
  values (p_user, p_workspace, p_type, left(p_title, 140), left(p_body, 500), p_link, auth.uid(), p_entity)
  on conflict do nothing;
end;
$$;

create or replace function public.task_link(p_task uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select '/w/' || w.slug || '/t/' || pr.key || '-' || t.number
    from public.tasks t
    join public.projects pr on pr.id = t.project_id
    join public.workspaces w on w.id = t.workspace_id
   where t.id = p_task;
$$;

create or replace function public.actor_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select full_name from public.profiles where id = auth.uid()), 'Someone');
$$;

revoke all on function public.log_activity(uuid, uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.notify(uuid, uuid, public.notification_type, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.actor_name() from public, anon, authenticated;
revoke all on function public.task_link(uuid) from public, anon;
grant execute on function public.task_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Activity + notification triggers
-- ---------------------------------------------------------------------------------------------

create or replace function public.tasks_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := (select key from public.projects where id = new.project_id) || '-' || new.number;
  v_base jsonb := jsonb_build_object('key', v_key, 'title', new.title);
  v_cmid text := nullif(current_setting('app.client_mutation_id', true), '');
  v_override text := nullif(current_setting('app.override_reason', true), '');
  r record;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.created', 'task', new.id, v_base);
    return null;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    perform public.log_activity(new.workspace_id, new.project_id, new.id,
      case when new.deleted_at is null then 'task.restored' else 'task.deleted' end, 'task', new.id, v_base);
    return null;
  end if;

  if new.status is distinct from old.status then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.status_changed', 'task', new.id,
      v_base || jsonb_build_object('field', 'status', 'from', old.status, 'to', new.status)
             || case when v_cmid is not null then jsonb_build_object('client_mutation_id', v_cmid) else '{}'::jsonb end
             || case when v_override is not null then jsonb_build_object('override_reason', v_override) else '{}'::jsonb end);
    for r in select user_id from public.task_assignees where task_id = new.id loop
      perform public.notify(r.user_id, new.workspace_id, 'status_changed_on_assigned',
        public.actor_name() || ' moved ' || v_key || ' to ' || replace(new.status::text, '_', ' '),
        new.title, public.task_link(new.id), new.id);
    end loop;
  end if;
  if new.priority is distinct from old.priority then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.updated', 'task', new.id,
      v_base || jsonb_build_object('field', 'priority', 'from', old.priority, 'to', new.priority));
  end if;
  if new.title is distinct from old.title then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.updated', 'task', new.id,
      v_base || jsonb_build_object('field', 'title', 'from', old.title, 'to', new.title));
  end if;
  if new.due_date is distinct from old.due_date then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.updated', 'task', new.id,
      v_base || jsonb_build_object('field', 'due_date', 'from', old.due_date, 'to', new.due_date));
  end if;
  if new.milestone_id is distinct from old.milestone_id then
    perform public.log_activity(new.workspace_id, new.project_id, new.id, 'task.updated', 'task', new.id,
      v_base || jsonb_build_object('field', 'milestone', 'from', (select name from public.milestones where id = old.milestone_id),
                                   'to', (select name from public.milestones where id = new.milestone_id)));
  end if;
  return null;
end;
$$;

create trigger tasks_activity after insert or update on public.tasks
  for each row execute function public.tasks_activity();

create or replace function public.task_assignees_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.task_assignees := coalesce(new, old);
  v_task public.tasks;
  v_key text;
  v_name text := (select full_name from public.profiles where id = v_row.user_id);
begin
  select * into v_task from public.tasks where id = v_row.task_id;
  if v_task.id is null then return null; end if;
  v_key := (select key from public.projects where id = v_task.project_id) || '-' || v_task.number;
  if tg_op = 'INSERT' then
    perform public.log_activity(v_task.workspace_id, v_task.project_id, v_task.id, 'task.assigned', 'task', v_task.id,
      jsonb_build_object('key', v_key, 'title', v_task.title, 'user_id', v_row.user_id, 'user_name', v_name));
    perform public.notify(v_row.user_id, v_task.workspace_id, 'task_assigned',
      public.actor_name() || ' assigned you ' || v_key, v_task.title, public.task_link(v_task.id), v_task.id);
  else
    perform public.log_activity(v_task.workspace_id, v_task.project_id, v_task.id, 'task.unassigned', 'task', v_task.id,
      jsonb_build_object('key', v_key, 'title', v_task.title, 'user_id', v_row.user_id, 'user_name', v_name));
  end if;
  return null;
end;
$$;

create trigger task_assignees_activity after insert or delete on public.task_assignees
  for each row execute function public.task_assignees_activity();

-- Comments: mentions (+ notifications), comment_on_assigned, activity.
create or replace function public.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks;
  v_key text;
  v_excerpt text := left(regexp_replace(new.body, '\s+', ' ', 'g'), 140);
  v_link text;
  r record;
begin
  select * into v_task from public.tasks where id = new.task_id;
  v_key := (select key from public.projects where id = v_task.project_id) || '-' || v_task.number;
  v_link := public.task_link(v_task.id);

  insert into public.comment_mentions (comment_id, user_id)
  select new.id, p.id
    from public.profiles p
    join public.project_members pm on pm.user_id = p.id and pm.project_id = new.project_id
   where p.handle::text = any (public.extract_mention_handles(new.body))
  on conflict do nothing;

  for r in select user_id from public.comment_mentions where comment_id = new.id loop
    perform public.notify(r.user_id, new.workspace_id, 'mentioned',
      public.actor_name() || ' mentioned you on ' || v_key, v_excerpt, v_link, v_task.id);
  end loop;

  for r in
    select distinct u from (
      select user_id as u from public.task_assignees where task_id = v_task.id
      union select v_task.created_by
    ) s
    where u is not null
      and u not in (select user_id from public.comment_mentions where comment_id = new.id)
  loop
    perform public.notify(r.u, new.workspace_id, 'comment_on_assigned',
      public.actor_name() || ' commented on ' || v_key, v_excerpt, v_link, v_task.id);
  end loop;

  perform public.log_activity(new.workspace_id, new.project_id, new.task_id, 'comment.added', 'comment', new.id,
    jsonb_build_object('key', v_key, 'title', v_task.title, 'excerpt', v_excerpt));
  return null;
end;
$$;

create trigger comments_after_insert after insert on public.comments
  for each row execute function public.comments_after_insert();

-- Mentions added when a comment is edited.
create or replace function public.comments_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.body is distinct from old.body then
    insert into public.comment_mentions (comment_id, user_id)
    select new.id, p.id
      from public.profiles p
      join public.project_members pm on pm.user_id = p.id and pm.project_id = new.project_id
     where p.handle::text = any (public.extract_mention_handles(new.body))
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger comments_after_update after update on public.comments
  for each row execute function public.comments_after_update();

create or replace function public.project_members_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.project_members := coalesce(new, old);
  v_project public.projects;
  v_name text := (select full_name from public.profiles where id = v_row.user_id);
begin
  select * into v_project from public.projects where id = v_row.project_id;
  if v_project.id is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(v_project.workspace_id, v_project.id, null, 'project.member_added', 'project', v_project.id,
      jsonb_build_object('project_name', v_project.name, 'user_id', v_row.user_id, 'user_name', v_name, 'role', v_row.role));
    perform public.notify(v_row.user_id, v_project.workspace_id, 'invited_to_project',
      public.actor_name() || ' added you to ' || v_project.name, null,
      '/w/' || (select slug from public.workspaces where id = v_project.workspace_id) || '/p/' || v_project.key, v_project.id);
  elsif tg_op = 'DELETE' then
    perform public.log_activity(v_project.workspace_id, v_project.id, null, 'project.member_removed', 'project', v_project.id,
      jsonb_build_object('project_name', v_project.name, 'user_id', v_row.user_id, 'user_name', v_name));
  elsif new.role is distinct from old.role then
    perform public.log_activity(v_project.workspace_id, v_project.id, null, 'project.member_role_changed', 'project', v_project.id,
      jsonb_build_object('project_name', v_project.name, 'user_id', v_row.user_id, 'user_name', v_name, 'from', old.role, 'to', new.role));
  end if;
  return null;
end;
$$;

create trigger project_members_activity after insert or update or delete on public.project_members
  for each row execute function public.project_members_activity();

create or replace function public.projects_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := jsonb_build_object('project_name', new.name, 'key', new.key);
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.workspace_id, new.id, null, 'project.created', 'project', new.id, v_meta);
  elsif new.status = 'archived' and old.status <> 'archived' then
    perform public.log_activity(new.workspace_id, new.id, null, 'project.archived', 'project', new.id, v_meta);
  elsif old.status = 'archived' and new.status <> 'archived' then
    perform public.log_activity(new.workspace_id, new.id, null, 'project.restored', 'project', new.id, v_meta);
  elsif new.deleted_at is distinct from old.deleted_at then
    perform public.log_activity(new.workspace_id, new.id, null,
      case when new.deleted_at is null then 'project.undeleted' else 'project.deleted' end, 'project', new.id, v_meta);
  end if;
  return null;
end;
$$;

create trigger projects_activity after insert or update of status, deleted_at on public.projects
  for each row execute function public.projects_activity();

create or replace function public.workspace_members_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.workspace_members := coalesce(new, old);
  v_name text := (select full_name from public.profiles where id = v_row.user_id);
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(v_row.workspace_id, null, null, 'member.joined', 'member', v_row.user_id,
      jsonb_build_object('user_name', v_name, 'role', v_row.role));
  elsif tg_op = 'DELETE' then
    perform public.log_activity(v_row.workspace_id, null, null, 'member.left', 'member', v_row.user_id,
      jsonb_build_object('user_name', v_name, 'removed_by_other', auth.uid() is distinct from v_row.user_id));
  elsif new.role is distinct from old.role then
    perform public.log_activity(v_row.workspace_id, null, null, 'member.role_changed', 'member', v_row.user_id,
      jsonb_build_object('user_name', v_name, 'from', old.role, 'to', new.role));
  end if;
  return null;
end;
$$;

create trigger workspace_members_activity after insert or update or delete on public.workspace_members
  for each row execute function public.workspace_members_activity();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_views enable row level security;

create policy activity_logs_select on public.activity_logs for select to authenticated
  using (case when project_id is null then public.is_workspace_member(workspace_id)
              else public.can_view_project(project_id) end);

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy saved_views_select on public.saved_views for select to authenticated
  using (user_id = (select auth.uid()) and public.can_view_project(project_id));
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_project(project_id));
create policy saved_views_update on public.saved_views for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_views_delete on public.saved_views for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.activity_logs, public.notifications, public.saved_views from anon;
revoke insert, update, delete, truncate on public.activity_logs from authenticated;
grant select on public.activity_logs to authenticated;
revoke insert, update, truncate on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update, truncate on public.saved_views from authenticated;
grant select, insert, delete on public.saved_views to authenticated;
grant update (name, filters, view_type) on public.saved_views to authenticated;

create or replace function public.mark_all_notifications_read(p_workspace uuid default null)
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  with u as (
    update public.notifications set read_at = now()
     where user_id = auth.uid() and read_at is null and (p_workspace is null or workspace_id = p_workspace)
    returning 1
  )
  select count(*)::int from u;
$$;
revoke all on function public.mark_all_notifications_read(uuid) from public, anon;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
