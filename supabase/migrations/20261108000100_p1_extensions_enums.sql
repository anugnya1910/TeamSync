-- Phase 1 · extensions, enums and generic trigger functions (spec §D.1, PHASE_1 Step 4)

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- All enums are created up-front to avoid enum alteration churn in later phases.
create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.project_role as enum ('lead', 'contributor', 'viewer');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.project_visibility as enum ('workspace', 'private');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');
create type public.task_priority as enum ('urgent', 'high', 'medium', 'low', 'none');
create type public.milestone_status as enum ('open', 'completed');
create type public.invite_status as enum ('active', 'revoked', 'exhausted', 'expired');
create type public.notification_type as enum (
  'task_assigned',
  'mentioned',
  'comment_on_assigned',
  'status_changed_on_assigned',
  'due_soon',
  'overdue',
  'invited_to_project',
  'achievement_unlocked',
  'rebalance_suggested'
);

-- Generic BEFORE UPDATE trigger maintaining updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
