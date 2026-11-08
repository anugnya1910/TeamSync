# PHASE 2 PROMPT — Core Full-Stack Application

> Paste this file into Claude Code together with `PROJECT_SPECIFICATION.md` and the current `IMPLEMENTATION_TRACKER.md`.
> **`PROJECT_SPECIFICATION.md` is authoritative.** Section references ("§B.7") point into it. Log any conflict in the tracker under *Decisions & Deviations*.

---

## 0. Your Role & Ground Rules

You are implementing **Phase 2: the core collaborative product** — workspaces administration, teams, projects, milestones, tasks, Kanban/list/calendar, comments, activity, notifications, realtime, search, filters and permissions. Every feature must persist real data in PostgreSQL and be protected by RLS.

**Do:**
- Read §B.0–B.17, §C.3–C.6, §D (all Phase-2 tables), §E, §F.7–F.10, §G (common definitions only) and §H before coding.
- Put cross-row invariants in Postgres (triggers / `SECURITY DEFINER` RPCs that begin with explicit permission checks and `SET search_path = public, pg_temp`).
- Use optimistic UI with rollback for move/edit/assign; every mutation shows success/error feedback.
- Start recording `task_status_history` **from the first task ever created** — Phase 3 analytics depend on it.
- Commit after each step; update the tracker as you go.

**Do NOT:**
- Implement dependencies, Pulse, workload, AI, gamification, analytics charts (Phase 3). Leave typed extension points instead.
- Let clients insert into `activity_logs`, `notifications`, `task_status_history`.
- Trust `workspace_id`, `project_id`, `created_by`, `number` from the client.
- Use any paid service or library. Allowed new deps: `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-markdown remark-gfm rehype-sanitize @tanstack/react-virtual fractional-indexing` (or a local fractional index util), `use-debounce`.

## 1. Objectives

1. Workspace administration: invites (link + email-bound), roles, leave/transfer/delete.
2. Teams CRUD and membership.
3. Projects (with templates), project members & capacity, milestones, labels.
4. Tasks with subtasks, assignees, labels, history, full CRUD and bulk actions.
5. Kanban (accessible DnD + realtime + presence), List view, Calendar (month; week is Advanced tier).
6. Comments with mentions, attachments (task-level), activity feed, notifications inbox.
7. Command-palette search and URL-driven filters; saved views (Advanced tier, do after MVP).
8. Permission matrix §B.0 enforced in DB and reflected in UI.

## 2. Prerequisites

Phase 1 acceptance criteria all green (check tracker). Local Supabase (or dev project) running; types generated.

## 3. Dependencies on Phase 1

Uses: Supabase clients, middleware, design system, app shell, `ComingSoon`/`EmptyState`, enums, `workspaces`, `workspace_members`, RLS helpers, avatars bucket, command palette architecture, CI.

---

## 4. Database Migrations (create in this order)

Use `supabase migration new <name>`. All tables: RLS enabled in the same migration; `updated_at` trigger where the column exists; indexes as in §D.2.

### M1 `p2_invitations_membership`
- `workspace_invitations` (§D.2 #4).
- RPCs (all `SECURITY DEFINER`, permission check first):
  - `create_invitation(p_workspace uuid, p_role workspace_role, p_email citext, p_max_uses int, p_expires_days int) returns table(invitation_id uuid, token text)` — admin only; generates 32 random bytes → base64url token; stores `encode(digest(token,'sha256'),'hex')`; returns raw token once.
  - `get_invitation_preview(p_token text) returns table(workspace_name text, workspace_slug text, role workspace_role, inviter_name text, status invite_status, expires_at timestamptz)` — callable by `authenticated` (and `anon` for the preview page) — returns nothing sensitive.
  - `accept_invitation(p_token text) returns workspaces` — validates status/expiry/uses/email match (`auth.jwt()->>'email'`), inserts membership (no-op if already member → raise `CONFLICT:already a member`), increments `use_count`, sets `exhausted` when reached; logs activity; sets `last_workspace_id`.
  - `revoke_invitation(p_id uuid)`.
  - `change_member_role(p_workspace uuid, p_user uuid, p_role workspace_role)` — admin; cannot set/unset `owner`; admins cannot demote other admins unless owner.
  - `remove_member(p_workspace uuid, p_user uuid)` — admin; not owner; cascades `team_members`, `project_members`, `task_assignees` for that workspace (unassign) and logs.
  - `leave_workspace(p_workspace uuid)` — not owner.
  - `transfer_ownership(p_workspace uuid, p_new_owner uuid)` — owner only; new owner must be member; old owner becomes admin.
  - `delete_workspace(p_workspace uuid, p_confirm_slug text)` — owner only; slug must match; soft delete (`deleted_at`), helper functions treat deleted workspaces as non-member.
- Update `is_workspace_member` to ignore soft-deleted workspaces.

### M2 `p2_teams`
- `teams`, `team_members` (§D.2 #5–6), trigger ensuring workspace membership, policies per §D.4.

### M3 `p2_projects`
- `projects`, `project_members`, `milestones`, `labels` (§D.2 #7–9, #12).
- RLS helpers: `can_view_project(uuid)`, `project_role_of(uuid)`, `can_edit_project_content(uuid)`, `is_project_lead(uuid)` (§D.4), with grants.
- Trigger on `project_members`: user must be workspace member; workspace guests forced to `viewer`; copy `workspace_id`.
- RPC `create_project(p_workspace uuid, p_name text, p_key text, p_description text, p_visibility project_visibility, p_start date, p_target date, p_team uuid, p_template text) returns projects` — caller role in (owner, admin, member); inserts project, caller as `lead`, team members as contributors if `p_team`; template milestones + task titles (templates defined in SQL: `blank`, `college_project`, `event_planning` — titles only, status `todo`/`backlog`, no dates/progress).
- RPC `set_project_member(p_project uuid, p_user uuid, p_role project_role, p_capacity int)` and `remove_project_member(...)` — lead only; removing unassigns that user from open tasks of the project.
- Soft delete / archive / restore RPCs (lead).

### M4 `p2_tasks`
- `tasks`, `task_assignees`, `task_labels`, `task_status_history` (§D.2 #10, #11, #13, #15).
- `tasks_before_insert` trigger: copy `workspace_id` from project; lock project row (`SELECT … FOR UPDATE`) and increment `task_counter` → `number`; default `position` = (max position in that status) + 1024; force `created_by = auth.uid()`; validate parent (same project, parent has no parent).
- `tasks_before_update` trigger: maintain `completed_at`; prevent changing `project_id`/`workspace_id`/`number`/`created_by` (raise); validate dates.
- `tasks_after_insert_update` trigger: insert `task_status_history` on insert (`from_status = null`) and on status change (store `effort_points` at time of change, `changed_by = auth.uid()`).
- Blocked rule (manual flag only in Phase 2; Phase 3 extends with dependencies): moving to `done` when `is_blocked = true` raises `TASK_BLOCKED:` unless caller is lead **and** session setting `app.override_reason` is set by `move_task`.
- Parent/subtask rule: parent → `done` with open subtasks raises `SUBTASKS_OPEN:` unless lead override.
- `task_assignees` trigger: assignee must be project member with role ≠ viewer; copy ids.
- RPC `move_task(p_task uuid, p_status task_status, p_before numeric, p_after numeric, p_override_reason text default null, p_client_mutation_id text default null) returns tasks` — `can_edit_project_content` check; computes position = midpoint (or ±1024 at ends); if gap < 1e-9 renormalise the column positions (1024 steps) in the same transaction; logs activity with `client_mutation_id` in metadata.
- RPC `set_task_assignees(p_task uuid, p_users uuid[])` and `set_task_labels(p_task uuid, p_labels uuid[])` — diff-based, emits notifications for newly assigned users.
- RPC `bulk_update_tasks(p_ids uuid[], p_patch jsonb)` — allowed keys: status, priority, milestone_id, due_date, assignee_add, assignee_remove; each task permission-checked.
- RLS per §D.4 (tasks SELECT excludes soft-deleted; separate lead-only policy to view/restore deleted in a "Trash" list — Advanced).
- Column revokes on immutable columns.

### M5 `p2_collaboration`
- `comments`, `comment_mentions`, `attachments` (§D.2 #16–18).
- Trigger `comments_after_insert`: parse `@handle` tokens (`(?<![\w@])@([a-z0-9_]{3,20})`), match only project members, insert `comment_mentions`; rate guard (> 30 comments/min/user → raise `RATE_LIMITED:`).
- Storage bucket `attachments` (private, 5 MB, MIME allowlist §B.13); storage policies parse `{workspace_id}/{project_id}/{task_id}/…` and call `can_view_project` / `can_edit_project_content` on segment 2.

### M6 `p2_activity_notifications`
- `activity_logs`, `notifications`, `saved_views` (§D.2 #19–21).
- Generic `log_activity(...)` internal function + triggers on tasks (create; update of status, priority, title, due_date, milestone; soft delete), task_assignees (add/remove), comments (insert), project_members (add/remove), projects (create/archive/restore), workspace_members (join/leave/role change). Metadata stores `{field, from, to}` diffs and human-readable labels (task key, project name) to render without joins.
- Notification triggers (respect `profiles.notification_prefs`; never notify the actor about their own action):
  - assignment → `task_assigned`
  - mention → `mentioned`
  - comment on a task where user is assignee or creator → `comment_on_assigned`
  - status change on task where user is assignee → `status_changed_on_assigned`
  - project member added → `invited_to_project`
- `notifications` policies: SELECT/DELETE own; UPDATE own limited to `read_at` (`REVOKE UPDATE` on all other columns).
- Notification `link` paths: `/w/{slug}/t/{KEY-n}` etc.

### M7 `p2_search`
- `search_vector` generated column + GIN index on tasks (if not created in M4); trigram optional (skip unless `pg_trgm` available — it is on Supabase).
- RPC `search_workspace(p_workspace uuid, p_query text, p_limit int default 20) returns table(kind text, id uuid, title text, subtitle text, url text, rank real)` — `SECURITY INVOKER`; matches tasks by FTS (`websearch_to_tsquery('simple', …)`) or key pattern `^[A-Za-z]{2,5}-\d+$`, projects by name ILIKE, members by name/handle ILIKE. RLS applies automatically.

### M8 `p2_realtime`
- `alter publication supabase_realtime add table tasks, task_assignees, comments, notifications, activity_logs;`
- `alter table tasks replica identity full;` (needed for meaningful UPDATE/DELETE payloads with filters) — document storage impact.

### M9 `p2_daily_jobs_base`
- Function `generate_due_notifications(p_date date)` (service role only): `due_soon` for open tasks due tomorrow, `overdue` for open tasks with due date = p_date − 1 (first day overdue only); dedup via unique index. Called by `/api/cron/daily` (implemented in Step 10).

After each migration: `npm run db:reset && npm run gen:types && npm run db:test`.

---

## 5. Backend Layer (Next.js)

- `src/lib/errors.ts`: `ActionResult<T>`, `ErrorCode`, `mapPgError()` per §E (prefix parsing `TASK_BLOCKED:`, `SUBTASKS_OPEN:`, `CONFLICT:`, `RATE_LIMITED:`; codes 42501/23505/23503/23514).
- `src/lib/validation/*.ts`: zod schemas for every action in §E.1 (Phase 2 rows), shared with forms.
- Server Actions grouped by domain under `src/app/(app)/w/[workspaceSlug]/_actions/` (`workspace.ts`, `team.ts`, `project.ts`, `task.ts`, `comment.ts`, `notification.ts`, `view.ts`). Each: parse → call RPC/query with session client → `revalidatePath` where server-rendered → return `ActionResult`.
- Data access hooks in `src/hooks/queries/` with TanStack Query keys documented in a single `query-keys.ts`.
- Route handler `/api/export/tasks.csv` (GET): project id + filter params → stream CSV under RLS with formula-injection escaping (§E.2).
- Route handler `/api/cron/daily` (POST, `CRON_SECRET` bearer, constant-time compare): calls `generate_due_notifications` with today in `APP_DEFAULT_TZ`; idempotent; returns counts. Uses admin client (only allowed place).
- Route handler `/api/health` (GET): `select 1` via anon client RPC `health_check()` returning `now()`; no data leakage.
- `.github/workflows/daily.yml` per §J.5.

---

## 6. Frontend Implementation (step by step)

### Step 1 — Workspace administration
- `/w/[ws]/members`: tabs **Members** (table → card list on mobile; role select for admins; remove with confirm; "You" badge; leave button) and **Invites** (create link dialog: role, max uses, expiry, optional email; shows copyable URL `${APP_URL}/invite/{token}` once with warning; list of active invites with revoke).
- `/invite/[token]`: public preview card (workspace, inviter, role, expiry state). Logged out → "Sign in / Sign up to join" (preserve `next`); logged in → "Join workspace" (accept RPC) → redirect.
- Onboarding Step 2 "I have an invite link" now works.
- `/w/[ws]/settings` (admin): General (name, slug with availability), Danger zone (transfer ownership dialog, delete workspace with type-slug confirmation). Non-admins see read-only info.
- Workspace switcher updates after join/leave.

### Step 2 — Teams
- `/w/[ws]/teams`: grid of team cards (colour, icon, member avatars, project count); create/edit dialog (admin); `/w/[ws]/teams/[teamId]` with member management (multi-select from workspace members) and the team's projects.

### Step 3 — Projects
- `/w/[ws]/projects`: toolbar (search, status filter, sort by name/updated/target date, grid ↔ table toggle persisted in URL); project cards (icon, colour accent bar, name, key, status pill, progress bar = done effort ÷ total effort (or "No tasks yet"), member avatars, target date); archived toggle.
- "New project" dialog (from sidebar "+", projects page, command palette, `N P` shortcut): name, key (auto-suggest from name initials, uppercase, availability check), icon/emoji picker (simple grid), colour, description, dates, visibility, team, template cards with preview of milestones/tasks. Creates via `create_project`, navigates to overview.
- Project layout `/w/[ws]/p/[key]/layout.tsx`: header (icon, name inline-editable for lead, status pill menu, member orbit, tabs: Overview, Board, List, Calendar, Dependencies*, Analytics*, Workload*, Settings) — *Phase 3 tabs render ComingSoon "Phase 3".
- **Overview**: description (markdown with edit for lead), milestones timeline (cards with due date, progress bar from real tasks, status), recent activity (last 15), member list with roles; right column reserves a Pulse card slot showing EmptyState "Project Pulse arrives in Phase 3".
- **Project settings** (lead): details, members & capacity table (add member from workspace, role select, capacity number input 0–200 with helper text "story points per week"), labels manager (name + colour from token palette), WIP limits per status, archive/restore, delete (soft) with confirmation.
- Onboarding Step 3 now offers creating a first project from a template.

### Step 4 — Tasks: create & detail
- Quick create: column "+" inline input (Enter to create, stays open for next), global "New task" dialog (`C`), command palette action. Fields in dialog: title, project (defaults to current), status, priority, assignees, due date, milestone, effort, labels, description.
- Natural-language date helper `parseQuickDate()` for "today", "tomorrow", weekday names, "+3d", "next week", ISO — unit tested.
- **Task detail sheet** (desktop right `Sheet` 640 px; mobile full-screen `Drawer`) and full page `/w/[ws]/t/[KEY-n]` via intercepting route `(.)t/[taskKey]` so board context is preserved. Contents per §F.10: inline title, key copy button, properties grid (status, priority, assignees multi-select with search, start/due date pickers, effort select, milestone select, labels multi-select, blocked toggle + reason), markdown description editor with Write/Preview tabs and autosave (debounce 600 ms, "Saved" indicator), subtasks list (add inline, check to complete, progress), attachments (drag-drop upload to `attachments` bucket via signed upload, list with signed download links, delete), tabs **Comments** and **Activity**.
- Actions menu: copy link, duplicate, convert to subtask of…, delete (soft, undo toast 5 s → restore).
- Error `TASK_BLOCKED` / `SUBTASKS_OPEN` → explanatory dialog; leads see "Override with reason".

### Step 5 — Kanban board (§B.9)
- `/w/[ws]/p/[key]/board`. Columns from statuses (`backlog` collapsible, `cancelled` hidden unless filtered). Column header: status icon, label, count, effort sum, WIP warning (amber outline when exceeded).
- `@dnd-kit` with `PointerSensor` (activation distance 6 px), `TouchSensor` (long-press 250 ms), `KeyboardSensor` with custom announcements ("Picked up TS-12 …", "Moved to In review, position 2 of 5"). `DragOverlay` shows a tilted card copy.
- On drop: optimistic cache update → `moveTask` with neighbour positions → on error rollback + toast (and blocked dialog).
- Card per §B.9; `React.memo`; virtualise columns with > 60 cards (`@tanstack/react-virtual`).
- Swimlanes toggle (Advanced tier): none / assignee / priority / milestone.
- Mobile: horizontal scroll-snap columns with sticky status tab bar; "Move to…" in card menu as DnD alternative.
- **Realtime** (`useProjectRealtime(projectId)`): subscribe to `tasks`, `task_assignees`, `comments` filtered by `project_id`; merge into query cache; skip events whose `client_mutation_id` matches pending local mutations; animate moved cards with Framer Motion `layout`; trigger `SyncLine`. Presence: track `{userId, name, avatarUrl, view:'board'|'list'|…}`; render orbit avatars in project header (max 5 + "+n"). Unsubscribe on unmount; reconnect with exponential backoff; show subtle "Reconnecting…" pill when channel is not `SUBSCRIBED`.

### Step 6 — List view (§B.10)
- Table with sticky header; columns per spec; sort by clicking headers (URL state); group by status/assignee/milestone/priority with collapsible groups and per-group counts; inline editors (status, priority, assignee, due); row click opens sheet.
- Multi-select (checkbox, shift-click range, `X` key) → floating bulk action bar (status, priority, assignee add/remove, milestone, due date, delete) → `bulk_update_tasks`.
- Virtualised when > 200 rows. Mobile: card list with the same grouping.

### Step 7 — Calendar (§B.11)
- Month grid built with `date-fns` honouring `profiles.week_start`; tasks on due date as compact chips (priority colour strip, key, title truncated; "+n more" popover); milestones as diamond markers; today highlighted; navigation prev/next/today; DnD a chip to another day → update `due_date` (contributor+). Unscheduled tasks drawer (side panel) supports dragging onto days.
- Week view with start→due spans (Advanced tier).
- Mobile: agenda list grouped by day.

### Step 8 — Comments, mentions, activity
- Comment composer: markdown textarea with `@` autocomplete (popover listing project members by name/handle, keyboard navigable), `⌘Enter` to send, preview tab. Render with `react-markdown` + `remark-gfm` + `rehype-sanitize`; mentions highlighted and linked to member profile popover.
- Edit (own, shows "edited"), delete (own or lead) with confirm. Realtime append.
- Activity tab and project/workspace feeds render `activity_logs` with icons and human sentences ("Priya moved **TS-14** from In progress → In review · 2h ago"), cursor pagination (30 per page, "Load more").

### Step 9 — Notifications
- Bell popover in topbar: unread count badge (realtime via `user:{uid}` channel), last 10 items, "Mark all read", "Open inbox".
- `/w/[ws]/inbox`: two-pane (list + preview with context: task title, snippet, quick actions "Open task", "Mark read"), filters by type and unread; mobile single pane.
- `/settings/notifications`: toggles per notification type stored in `profiles.notification_prefs`.

### Step 10 — Search, filters, My Tasks, Dashboard
- **Command palette**: async group calling `search_workspace` (debounced 200 ms, abortable), groups Tasks/Projects/Members, plus actions (New task, New project, Go to …), recent searches in localStorage (try/catch). Typing `TS-42` jumps straight to the task.
- **Filter bar** (shared component) on Board/List/Calendar: assignee (me/unassigned/specific), status, priority, label, milestone, due (overdue/today/this week/no date), blocked, text. State in URL query (`useSearchParams`), "Clear all", count badge. Filtering done in the Supabase query where possible.
- **Saved views** (Advanced tier): save current filters with a name; list in a dropdown.
- **My Tasks** `/w/[ws]/my-tasks`: tasks assigned to me across visible projects grouped Overdue / Today / This week / Later / No date, with inline status change.
- **Dashboard** now uses real data: My focus (overdue, due today, in progress), Projects grid (progress from real tasks; Pulse slot shows "Phase 3"), Recent activity, Upcoming milestones (next 14 days), onboarding checklist with real states.
- **Export**: "Export CSV" button on List view (respects filters) → `/api/export/tasks.csv`.

### Step 11 — Permissions in UI
- `usePermissions(projectId)` hook derived from `workspace_role_of` + `project_role_of` (fetched once per project layout) exposes booleans matching §B.0. Hide or disable (with tooltip explaining why) controls the user lacks — the DB still enforces.
- Viewer mode: board DnD disabled, inline editors read-only, banner "You have view-only access".
- Foreign or non-existent resource → `notFound()` (do not reveal existence).

---

## 7. Testing Requirements

### pgTAP (`supabase/tests/phase2_*.test.sql`, ≥ 45 assertions total)
- Isolation: for **every** Phase 2 table, outsider (other workspace) sees 0 rows and cannot insert/update/delete.
- Roles: guest cannot create projects; viewer cannot create/update tasks but can comment; contributor cannot edit project settings; lead can; workspace admin acts as lead on all projects.
- Private project invisible to non-member workspace members, including via `search_workspace`.
- Invitations: expired/revoked/exhausted rejected; email-bound invite rejects other email; accepting twice → CONFLICT; raw token never stored.
- Task numbering unique and sequential under concurrent inserts (two transactions using `dblink` or sequential simulation).
- `task_status_history` row on insert and every status change; `completed_at` set/cleared.
- `TASK_BLOCKED` for contributor; override works for lead with reason (activity logged).
- `move_task` renormalisation keeps order.
- Assigning a non-member/viewer rejected.
- Clients cannot insert into `activity_logs`, `notifications`, `task_status_history`.
- Mentions only for project members; notifications not sent to actor; preferences respected.
- `generate_due_notifications` idempotent for same date.
- Storage: user of another workspace cannot read an attachment object.

### Vitest
- `parseQuickDate`, fractional position helpers, `mapPgError`, CSV escaping, filter ↔ URL serialisation, permission hook logic, mention parser (client mirror).

### Playwright (two browser contexts for realtime)
1. Owner creates invite link → second user joins via link → appears in members list.
2. Create project from *College Project* template → milestones and tasks exist.
3. Create task via quick add → drag to In progress → second context sees it move within 3 s (realtime) without reload.
4. Keyboard-only DnD moves a card (space, arrows, space) and the move persists after reload.
5. Comment with `@mention` → mentioned user gets bell badge + inbox item in real time.
6. Viewer cannot drag or edit (controls disabled) and direct supabase-js update attempt from the page context is rejected.
7. Filters via URL: open `/board?assignee=me&priority=urgent` → only matching cards.
8. ⌘K search by key `TS-1` opens the task.
9. Calendar drag changes due date; List bulk action changes priority of 3 tasks.
10. CSV export downloads with correct headers and row count.
11. Mobile viewport: board snap columns + "Move to…" works; no horizontal page overflow on all new pages.
12. axe: 0 serious/critical on members, projects, board, list, calendar, task page, inbox.

---

## 8. Deliverables

- Migrations M1–M9 applied locally and pushed to production (`supabase db push`) — record status per environment.
- All Phase 2 screens functional with real data, realtime and permissions.
- Daily cron route + GitHub workflow.
- Test suites above, CI green.
- Screenshots (light/dark, desktop/mobile) of board, list, calendar, task sheet, inbox, members → `docs/screenshots/phase2/`.
- Tracker updated: features, migrations, files, tests, bugs, deviations.

## 9. Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| AC1 | All Phase 2 MVP features in §Appendix 2 work end-to-end and persist after reload | Playwright 1–10 + manual checklist |
| AC2 | Workspace isolation holds for every new table (incl. storage) | pgTAP isolation suite |
| AC3 | Permission matrix §B.0 enforced by DB (not just UI) | pgTAP role tests + Playwright 6 |
| AC4 | Realtime: board moves, new comments, notifications appear in another session ≤ 3 s | Playwright 3, 5 |
| AC5 | Keyboard DnD and screen-reader announcements work | Playwright 4 + manual NVDA/VoiceOver note |
| AC6 | `task_status_history` complete for every task status change | pgTAP + SQL spot check |
| AC7 | No client can write activity/notifications/history | pgTAP |
| AC8 | Search returns only permitted results, < 300 ms locally for 1 000 tasks | pgTAP + timing note |
| AC9 | Board with 300 tasks remains responsive (no long tasks > 200 ms on drag in Chrome performance panel) | manual profiling note |
| AC10 | Loading, empty and error states exist for every new page; no dead buttons; Phase 3 slots show ComingSoon | manual checklist |
| AC11 | 360 px: no horizontal page scroll; mobile alternatives for DnD | Playwright 11 |
| AC12 | 0 serious/critical axe violations on new pages | Playwright 12 |
| AC13 | CI green (lint, typecheck, unit, pgTAP, build) | GitHub Actions |
| AC14 | `/api/cron/daily` rejects missing/wrong secret (401) and is idempotent | integration test |

## 10. Completion Verification

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run db:reset && npm run db:test
npm run test:e2e
curl -i -X POST http://localhost:3000/api/cron/daily            # expect 401
curl -i -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily   # expect 200, run twice → same counts second time = 0 new
```

Run the §H.3 audit queries (0 rows). Update the tracker (Phase 2 checklist, migrations local/prod, test counts, bugs, deviations) and write a handover note listing extension points for Phase 3 (effective-blocked computation hook, Pulse card slot, analytics routes, gamification triggers on status change).
