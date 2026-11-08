-- Phase 2 · M5 comments, mentions, attachments (spec §B.13, §D.2 #16–18, §H.1 uploads)

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null,
  workspace_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id, created_at);
create index comments_author_idx on public.comments (author_id, created_at);

create table public.comment_mentions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (comment_id, user_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  task_id uuid not null references public.tasks (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null,
  size_bytes int not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments (task_id);

-- Comments: ids from the task, author forced, rate limit, edit tracking.
create or replace function public.comments_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    select project_id, workspace_id into new.project_id, new.workspace_id
      from public.tasks where id = new.task_id and deleted_at is null;
    if new.project_id is null then
      raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
    end if;
    new.author_id := coalesce(auth.uid(), new.author_id);
    new.edited_at := null;
    new.deleted_at := null;
    if (select count(*) from public.comments
         where author_id = new.author_id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'RATE_LIMITED: you are commenting too quickly — wait a moment';
    end if;
  else
    if new.task_id <> old.task_id or new.author_id is distinct from old.author_id then
      raise exception 'FORBIDDEN: comment ownership cannot change' using errcode = '42501';
    end if;
    if new.body is distinct from old.body then
      new.edited_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_before_write before insert or update on public.comments
  for each row execute function public.comments_before_write();

-- Mentions: `@handle` tokens matched against project members (client mirror in lib/mentions.ts).
create or replace function public.extract_mention_handles(p_body text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct m[1]), '{}')
    from regexp_matches(lower(coalesce(p_body, '')), '(?<![a-z0-9_@])@([a-z0-9_]{3,20})', 'g') as m;
$$;

create or replace function public.attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select project_id, workspace_id into new.project_id, new.workspace_id
    from public.tasks where id = new.task_id and deleted_at is null;
  if new.project_id is null then
    raise exception 'NOT_FOUND: task not found' using errcode = 'P0002';
  end if;
  if new.storage_path not like new.workspace_id || '/' || new.project_id || '/' || new.task_id || '/%' then
    raise exception 'VALIDATION: attachment path does not match the task' using errcode = '23514';
  end if;
  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  return new;
end;
$$;

create trigger attachments_before_insert before insert on public.attachments
  for each row execute function public.attachments_before_insert();

alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.attachments enable row level security;

create policy comments_select on public.comments for select to authenticated
  using (deleted_at is null and public.can_view_project(project_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (public.can_view_project(project_id) and author_id = (select auth.uid()));
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and public.can_view_project(project_id))
  with check (author_id = (select auth.uid()));
create policy comments_delete on public.comments for delete to authenticated
  using (public.can_view_project(project_id)
         and (author_id = (select auth.uid()) or public.is_project_lead(project_id)));

create policy comment_mentions_select on public.comment_mentions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id and public.can_view_project(c.project_id)));

create policy attachments_select on public.attachments for select to authenticated
  using (public.can_view_project(project_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.can_edit_project_content(project_id) and uploaded_by = (select auth.uid()));
create policy attachments_delete on public.attachments for delete to authenticated
  using (public.can_view_project(project_id)
         and (uploaded_by = (select auth.uid()) or public.is_project_lead(project_id)));

revoke all on public.comments, public.comment_mentions, public.attachments from anon;
revoke update, truncate on public.comments from authenticated;
grant select, insert, delete on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
revoke insert, update, delete, truncate on public.comment_mentions from authenticated;
grant select on public.comment_mentions to authenticated;
revoke update, truncate on public.attachments from authenticated;
grant select, insert, delete on public.attachments to authenticated;

-- Private attachments bucket (5 MB, allowlist; SVG/HTML never allowed).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', false, 5242880,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path: {workspace_id}/{project_id}/{task_id}/{uuid}-{name}; authorise on segment 2 (project).
create policy attachments_objects_read on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments'
         and public.can_view_project(public.try_uuid((storage.foldername(name))[2])));

create policy attachments_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments'
              and public.can_edit_project_content(public.try_uuid((storage.foldername(name))[2]))
              and exists (
                select 1 from public.tasks t
                 where t.id = public.try_uuid((storage.foldername(name))[3])
                   and t.project_id = public.try_uuid((storage.foldername(name))[2])
                   and t.workspace_id = public.try_uuid((storage.foldername(name))[1])
              ));

create policy attachments_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments'
         and public.can_view_project(public.try_uuid((storage.foldername(name))[2]))
         and (owner_id = (select auth.uid())::text
              or public.is_project_lead(public.try_uuid((storage.foldername(name))[2]))));
