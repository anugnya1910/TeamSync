-- Phase 2 · M1 invitations & membership administration (spec §B.3, §D.2 #4, PHASE_2 M1)

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique,
  email extensions.citext,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  invited_by uuid references public.profiles (id) on delete set null,
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  use_count int not null default 0 check (use_count >= 0),
  expires_at timestamptz not null default now() + interval '7 days',
  status public.invite_status not null default 'active',
  created_at timestamptz not null default now()
);

create index workspace_invitations_ws_idx on public.workspace_invitations (workspace_id, status);

alter table public.workspace_invitations enable row level security;

create policy invitations_select_admin on public.workspace_invitations
  for select to authenticated using (public.is_workspace_admin(workspace_id));
create policy invitations_delete_admin on public.workspace_invitations
  for delete to authenticated using (public.is_workspace_admin(workspace_id));

revoke all on public.workspace_invitations from anon;
revoke insert, update, truncate on public.workspace_invitations from authenticated;
grant select, delete on public.workspace_invitations to authenticated;

-- Effective status (expiry / exhaustion are evaluated lazily).
create or replace function public.invitation_effective_status(i public.workspace_invitations)
returns public.invite_status
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when i.status <> 'active' then i.status
    when i.expires_at <= now() then 'expired'::public.invite_status
    when i.use_count >= i.max_uses then 'exhausted'::public.invite_status
    else 'active'::public.invite_status
  end;
$$;

create or replace function public.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_invitation(
  p_workspace uuid,
  p_role public.workspace_role,
  p_email extensions.citext default null,
  p_max_uses int default 1,
  p_expires_days int default 7
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;
  if not public.is_workspace_admin(p_workspace) then
    raise exception 'FORBIDDEN: only owners and admins can invite' using errcode = '42501';
  end if;
  if p_role is null or p_role = 'owner' then
    raise exception 'VALIDATION: invites cannot grant the owner role' using errcode = '23514';
  end if;
  if coalesce(p_max_uses, 1) not between 1 and 1000 then
    raise exception 'VALIDATION: max uses must be between 1 and 1000' using errcode = '23514';
  end if;
  if coalesce(p_expires_days, 7) not between 1 and 30 then
    raise exception 'VALIDATION: expiry must be between 1 and 30 days' using errcode = '23514';
  end if;
  if p_email is not null and p_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'VALIDATION: invalid email address' using errcode = '23514';
  end if;

  -- 32 random bytes → base64url (43 chars). Only the SHA-256 hash is stored.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.workspace_invitations (workspace_id, token_hash, email, role, invited_by, max_uses, expires_at)
  values (
    p_workspace,
    public.hash_invite_token(v_token),
    nullif(btrim(coalesce(p_email::text, '')), ''),
    p_role,
    auth.uid(),
    coalesce(p_max_uses, 1),
    now() + make_interval(days => coalesce(p_expires_days, 7))
  )
  returning id into v_id;

  invitation_id := v_id;
  token := v_token;
  return next;
end;
$$;

create or replace function public.get_invitation_preview(p_token text)
returns table (
  workspace_name text,
  workspace_slug text,
  role public.workspace_role,
  inviter_name text,
  status public.invite_status,
  expires_at timestamptz,
  email_bound boolean,
  already_member boolean
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select w.name,
         w.slug::text,
         i.role,
         p.full_name,
         public.invitation_effective_status(i),
         i.expires_at,
         i.email is not null,
         exists (
           select 1 from public.workspace_members m
            where m.workspace_id = w.id and m.user_id = auth.uid()
         )
    from public.workspace_invitations i
    join public.workspaces w on w.id = i.workspace_id and w.deleted_at is null
    left join public.profiles p on p.id = i.invited_by
   where i.token_hash = public.hash_invite_token(p_token)
     and p_token ~ '^[A-Za-z0-9_-]{16,128}$';
$$;

create or replace function public.accept_invitation(p_token text)
returns public.workspaces
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.workspace_invitations;
  v_ws public.workspaces;
  v_status public.invite_status;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: sign in required' using errcode = '42501';
  end if;

  select * into v_inv
    from public.workspace_invitations
   where token_hash = public.hash_invite_token(p_token)
   for update;
  if v_inv.id is null then
    raise exception 'NOT_FOUND: this invite link is not valid' using errcode = 'P0002';
  end if;

  select * into v_ws from public.workspaces where id = v_inv.workspace_id and deleted_at is null;
  if v_ws.id is null then
    raise exception 'NOT_FOUND: this workspace no longer exists' using errcode = 'P0002';
  end if;

  v_status := public.invitation_effective_status(v_inv);
  if v_status = 'revoked' then
    raise exception 'VALIDATION: this invite has been revoked';
  elsif v_status = 'expired' then
    if v_inv.status = 'active' then
      update public.workspace_invitations set status = 'expired' where id = v_inv.id;
    end if;
    raise exception 'VALIDATION: this invite has expired';
  elsif v_status = 'exhausted' then
    raise exception 'VALIDATION: this invite has already been used';
  end if;

  if v_inv.email is not null and lower(v_inv.email::text) <> v_email then
    raise exception 'FORBIDDEN: this invite was sent to a different email address' using errcode = '42501';
  end if;

  if exists (select 1 from public.workspace_members where workspace_id = v_ws.id and user_id = v_uid) then
    raise exception 'CONFLICT: you are already a member of this workspace';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws.id, v_uid, v_inv.role);

  update public.workspace_invitations
     set use_count = use_count + 1,
         status = case when use_count + 1 >= max_uses then 'exhausted'::public.invite_status else status end
   where id = v_inv.id;

  update public.profiles
     set last_workspace_id = v_ws.id,
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;

  return v_ws;
end;
$$;

create or replace function public.revoke_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.workspace_invitations where id = p_id;
  if v_ws is null or not public.is_workspace_admin(v_ws) then
    raise exception 'NOT_FOUND: invitation not found' using errcode = 'P0002';
  end if;
  update public.workspace_invitations set status = 'revoked' where id = p_id and status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Membership administration
-- ---------------------------------------------------------------------------------------------

-- Unassigns `p_user` from open tasks in a workspace (used before removal / leaving).
create or replace function public._unassign_open_tasks(p_workspace uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if to_regclass('public.task_assignees') is null then
    return;
  end if;
  delete from public.task_assignees ta
   using public.tasks t
   where ta.task_id = t.id
     and ta.user_id = p_user
     and ta.workspace_id = p_workspace
     and t.status not in ('done', 'cancelled');
end;
$$;
revoke all on function public._unassign_open_tasks(uuid, uuid) from public, anon, authenticated;

create or replace function public.change_member_role(
  p_workspace uuid,
  p_user uuid,
  p_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_caller public.workspace_role := public.workspace_role_of(p_workspace);
  v_target public.workspace_role;
begin
  if v_caller is null or v_caller not in ('owner', 'admin') then
    raise exception 'FORBIDDEN: only owners and admins can change roles' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'VALIDATION: use ownership transfer to assign a new owner' using errcode = '23514';
  end if;
  select role into v_target from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if v_target is null then
    raise exception 'NOT_FOUND: member not found' using errcode = 'P0002';
  end if;
  if v_target = 'owner' then
    raise exception 'FORBIDDEN: the owner role can only change through ownership transfer' using errcode = '42501';
  end if;
  if v_target = 'admin' and v_caller <> 'owner' and p_user <> auth.uid() then
    raise exception 'FORBIDDEN: only the owner can change another admin''s role' using errcode = '42501';
  end if;

  update public.workspace_members set role = p_role where workspace_id = p_workspace and user_id = p_user;

  -- Guests can only ever be viewers on projects.
  if p_role = 'guest' and to_regclass('public.project_members') is not null then
    update public.project_members set role = 'viewer'
     where workspace_id = p_workspace and user_id = p_user and role <> 'viewer';
    perform public._unassign_open_tasks(p_workspace, p_user);
  end if;
end;
$$;

create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_caller public.workspace_role := public.workspace_role_of(p_workspace);
  v_target public.workspace_role;
begin
  if v_caller is null or v_caller not in ('owner', 'admin') then
    raise exception 'FORBIDDEN: only owners and admins can remove members' using errcode = '42501';
  end if;
  select role into v_target from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if v_target is null then
    raise exception 'NOT_FOUND: member not found' using errcode = 'P0002';
  end if;
  if v_target = 'owner' then
    raise exception 'FORBIDDEN: the owner cannot be removed' using errcode = '42501';
  end if;
  if v_target = 'admin' and v_caller <> 'owner' then
    raise exception 'FORBIDDEN: only the owner can remove an admin' using errcode = '42501';
  end if;

  perform public._unassign_open_tasks(p_workspace, p_user);
  -- team_members / project_members cascade through their FK to workspace_members.
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  update public.profiles set last_workspace_id = null where id = p_user and last_workspace_id = p_workspace;
end;
$$;

create or replace function public.leave_workspace(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.workspace_role := public.workspace_role_of(p_workspace);
begin
  if v_uid is null or v_role is null then
    raise exception 'NOT_FOUND: workspace not found' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'FORBIDDEN: transfer ownership before leaving the workspace' using errcode = '42501';
  end if;
  perform public._unassign_open_tasks(p_workspace, v_uid);
  delete from public.workspace_members where workspace_id = p_workspace and user_id = v_uid;
  update public.profiles set last_workspace_id = null where id = v_uid and last_workspace_id = p_workspace;
end;
$$;

create or replace function public.transfer_ownership(p_workspace uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.workspace_role;
begin
  if public.workspace_role_of(p_workspace) is distinct from 'owner' then
    raise exception 'FORBIDDEN: only the owner can transfer ownership' using errcode = '42501';
  end if;
  if p_new_owner = v_uid then
    raise exception 'VALIDATION: you already own this workspace' using errcode = '23514';
  end if;
  select role into v_target from public.workspace_members where workspace_id = p_workspace and user_id = p_new_owner;
  if v_target is null then
    raise exception 'VALIDATION: the new owner must be a member of the workspace' using errcode = '23514';
  end if;
  if v_target = 'guest' then
    raise exception 'VALIDATION: guests cannot become owner' using errcode = '23514';
  end if;

  perform set_config('teamsync.allow_owner_change', 'on', true);
  update public.workspace_members set role = 'admin' where workspace_id = p_workspace and user_id = v_uid;
  update public.workspace_members set role = 'owner' where workspace_id = p_workspace and user_id = p_new_owner;
  update public.workspaces set owner_id = p_new_owner where id = p_workspace;
  perform set_config('teamsync.allow_owner_change', 'off', true);
end;
$$;

create or replace function public.delete_workspace(p_workspace uuid, p_confirm_slug text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ws public.workspaces;
begin
  if public.workspace_role_of(p_workspace) is distinct from 'owner' then
    raise exception 'FORBIDDEN: only the owner can delete the workspace' using errcode = '42501';
  end if;
  select * into v_ws from public.workspaces where id = p_workspace;
  if v_ws.slug::text <> coalesce(p_confirm_slug, '') then
    raise exception 'VALIDATION: type the workspace URL exactly to confirm' using errcode = '23514';
  end if;
  update public.workspaces set deleted_at = now() where id = p_workspace;
  update public.workspace_invitations set status = 'revoked' where workspace_id = p_workspace and status = 'active';
  update public.profiles set last_workspace_id = null where last_workspace_id = p_workspace;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_invitation(uuid, public.workspace_role, extensions.citext, int, int)',
    'public.accept_invitation(text)',
    'public.revoke_invitation(uuid)',
    'public.change_member_role(uuid, uuid, public.workspace_role)',
    'public.remove_member(uuid, uuid)',
    'public.leave_workspace(uuid)',
    'public.transfer_ownership(uuid, uuid)',
    'public.delete_workspace(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
