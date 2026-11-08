-- Phase 2 pgTAP suite: isolation, roles, invitations, tasks, collaboration, notifications (PHASE_2 §7).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(78);

-- Helpers ------------------------------------------------------------------------------------
create schema tests;
create table tests.vars (k text primary key, v text);
grant usage on schema tests to anon, authenticated;
grant all on tests.vars to anon, authenticated;
create function tests.v(p text) returns text language sql stable as $$ select v from tests.vars where k = p $$;
create function tests.u(p text) returns uuid language sql stable as $$ select v::uuid from tests.vars where k = p $$;
grant execute on all functions in schema tests to anon, authenticated;
create function tests.claims(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated', 'email', (select email from auth.users where id = p))::text, true);
$$;
grant execute on function tests.claims(uuid) to anon, authenticated;

-- Users: O owner · A admin · M member · V member (project viewer) · G guest · X joiner · W outsider · Y, Z invitees
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('10000000-0000-4000-8000-000000000001', 'owner@t.dev',  '{"full_name":"Olivia Owner"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000002', 'admin@t.dev',  '{"full_name":"Arjun Admin"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000003', 'member@t.dev', '{"full_name":"Meera Member"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000004', 'viewer@t.dev', '{"full_name":"Vikram Viewer"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000005', 'guest@t.dev',  '{"full_name":"Gita Guest"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000006', 'joiner@t.dev', '{"full_name":"Jay Joiner"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000007', 'outsider@t.dev', '{"full_name":"Wen Outsider"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000008', 'y@t.dev', '{"full_name":"Yusuf"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000009', 'z@t.dev', '{"full_name":"Zara"}', 'authenticated', 'authenticated');
insert into tests.vars values
  ('O', '10000000-0000-4000-8000-000000000001'), ('A', '10000000-0000-4000-8000-000000000002'),
  ('M', '10000000-0000-4000-8000-000000000003'), ('V', '10000000-0000-4000-8000-000000000004'),
  ('G', '10000000-0000-4000-8000-000000000005'), ('X', '10000000-0000-4000-8000-000000000006'),
  ('W', '10000000-0000-4000-8000-000000000007'), ('Y', '10000000-0000-4000-8000-000000000008'),
  ('Z', '10000000-0000-4000-8000-000000000009');
insert into tests.vars select 'o_handle', handle::text from profiles where id = tests.u('O');
insert into tests.vars select 'w_handle', handle::text from profiles where id = tests.u('W');

-- Workspaces
select tests.claims(tests.u('O')); set local role authenticated;
insert into tests.vars select 'ws1', (create_workspace('Alpha', 'alpha-p2')).id::text;
reset role;
select tests.claims(tests.u('W')); set local role authenticated;
insert into tests.vars select 'ws2', (create_workspace('Beta', 'beta-p2')).id::text;
reset role;
insert into workspace_members (workspace_id, user_id, role) values
  (tests.u('ws1'), tests.u('A'), 'admin'), (tests.u('ws1'), tests.u('M'), 'member'),
  (tests.u('ws1'), tests.u('V'), 'member'), (tests.u('ws1'), tests.u('G'), 'guest');

-- ============================== Invitations ===================================================
select tests.claims(tests.u('M')); set local role authenticated;
select throws_ok($$select * from create_invitation(tests.u('ws1'), 'member', null, 1, 7)$$, '42501', null,
  '1 member cannot create invitations');
reset role;

select tests.claims(tests.u('O')); set local role authenticated;
insert into tests.vars select 'tok_multi', token from create_invitation(tests.u('ws1'), 'member', null, 2, 7);
insert into tests.vars select 'tok_email', token from create_invitation(tests.u('ws1'), 'member', 'someone@else.dev', 1, 7);
insert into tests.vars select 'tok_single', token from create_invitation(tests.u('ws1'), 'member', null, 1, 7);
insert into tests.vars select 'tok_revoke', token from create_invitation(tests.u('ws1'), 'member', null, 5, 7);
insert into tests.vars select 'tok_expire', token from create_invitation(tests.u('ws1'), 'member', null, 5, 7);
select throws_ok($$select * from create_invitation(tests.u('ws1'), 'owner', null, 1, 7)$$, '23514', null,
  '2 invites cannot grant owner');
reset role;

select is_empty($$select 1 from workspace_invitations where token_hash = tests.v('tok_multi')$$, '3 raw token is never stored');
select isnt_empty($$select 1 from workspace_invitations where token_hash = hash_invite_token(tests.v('tok_multi'))$$,
  '4 only the SHA-256 hash is stored');

set local role anon;
select is((select workspace_name from get_invitation_preview(tests.v('tok_multi'))), 'Alpha', '5 anon can preview an invite');
reset role;

select tests.claims(tests.u('X')); set local role authenticated;
select lives_ok($$select accept_invitation(tests.v('tok_multi'))$$, '6 valid invite accepted');
select throws_like($$select accept_invitation(tests.v('tok_multi'))$$, 'CONFLICT:%', '7 accepting twice is a conflict');
reset role;
select is((select role::text from workspace_members where workspace_id = tests.u('ws1') and user_id = tests.u('X')), 'member',
  '8 joiner has the invited role');

select tests.claims(tests.u('Y')); set local role authenticated;
select throws_ok($$select accept_invitation(tests.v('tok_email'))$$, '42501', null, '9 email-bound invite rejects other email');
select lives_ok($$select accept_invitation(tests.v('tok_single'))$$, '10 single-use invite works once');
reset role;
select tests.claims(tests.u('Z')); set local role authenticated;
select throws_like($$select accept_invitation(tests.v('tok_single'))$$, '%already been used%', '11 exhausted invite rejected');
reset role;

select tests.claims(tests.u('O')); set local role authenticated;
select revoke_invitation((select id from workspace_invitations where token_hash = hash_invite_token(tests.v('tok_revoke'))));
reset role;
update workspace_invitations set expires_at = now() - interval '1 minute'
 where token_hash = hash_invite_token(tests.v('tok_expire'));
select tests.claims(tests.u('Z')); set local role authenticated;
select throws_like($$select accept_invitation(tests.v('tok_revoke'))$$, '%revoked%', '12 revoked invite rejected');
select throws_like($$select accept_invitation(tests.v('tok_expire'))$$, '%expired%', '13 expired invite rejected');
reset role;

-- ============================== Membership administration ====================================
select tests.claims(tests.u('M')); set local role authenticated;
select throws_ok($$select change_member_role(tests.u('ws1'), tests.u('X'), 'admin')$$, '42501', null, '14 member cannot change roles');
reset role;
select tests.claims(tests.u('A')); set local role authenticated;
select throws_ok($$select remove_member(tests.u('ws1'), tests.u('O'))$$, '42501', null, '15 admin cannot remove the owner');
reset role;
select tests.claims(tests.u('O')); set local role authenticated;
select throws_ok($$select leave_workspace(tests.u('ws1'))$$, '42501', null, '16 owner cannot leave without transferring');
select lives_ok($$select transfer_ownership(tests.u('ws1'), tests.u('A'))$$, '17 owner transfers ownership');
reset role;
select results_eq(
  $$select user_id::text || ':' || role from workspace_members where workspace_id = tests.u('ws1') and user_id in (tests.u('O'), tests.u('A')) order by role$$,
  $$values (tests.v('A') || ':owner'), (tests.v('O') || ':admin')$$,
  '18 new owner promoted, old owner becomes admin');
select is((select owner_id from workspaces where id = tests.u('ws1')), tests.u('A'), '19 workspaces.owner_id updated');
select tests.claims(tests.u('A')); set local role authenticated;
select transfer_ownership(tests.u('ws1'), tests.u('O'));
reset role;

-- ============================== Teams =========================================================
select tests.claims(tests.u('A')); set local role authenticated;
select lives_ok($$insert into teams (workspace_id, name) values (tests.u('ws1'), 'Frontend')$$, '20 admin creates a team');
select throws_ok($$select set_team_members((select id from teams where name = 'Frontend'), array[tests.u('W')])$$, '23514', null,
  '21 non-workspace user cannot join a team');
select set_team_members((select id from teams where name = 'Frontend'), array[tests.u('M'), tests.u('X')]);
reset role;
select tests.claims(tests.u('M')); set local role authenticated;
select throws_ok($$insert into teams (workspace_id, name, created_by) values (tests.u('ws1'), 'Rogue', tests.u('M'))$$, '42501', null,
  '22 member cannot create teams');
reset role;

-- ============================== Projects ======================================================
select tests.claims(tests.u('G')); set local role authenticated;
select throws_ok($$select create_project(tests.u('ws1'), 'Guest Project', 'GP')$$, '42501', null, '23 guest cannot create projects');
reset role;

select tests.claims(tests.u('O')); set local role authenticated;
insert into tests.vars select 'p1', (create_project(tests.u('ws1'), 'Capstone', 'CAP', null, 'workspace', null, null,
  (select id from teams where name = 'Frontend'), 'college_project')).id::text;
insert into tests.vars select 'prv', (create_project(tests.u('ws1'), 'Secret Plans', 'PRV', null, 'private')).id::text;
select throws_like($$select create_project(tests.u('ws1'), 'Again', 'CAP')$$, 'CONFLICT:%', '24 duplicate project key conflicts');
select set_project_member(tests.u('p1'), tests.u('V'), 'viewer', 10);
select set_project_member(tests.u('p1'), tests.u('G'), 'contributor', 10);
reset role;

select is((select count(*)::int from milestones where project_id = tests.u('p1')), 4, '25 template created 4 milestones');
select is((select count(*)::int from tasks where project_id = tests.u('p1')), 16, '26 template created 16 task titles');
select is((select count(*)::int from tasks where project_id = tests.u('p1') and (due_date is not null or status = 'done')), 0,
  '27 template tasks have no dates or progress');
select is((select role::text from project_members where project_id = tests.u('p1') and user_id = tests.u('M')), 'contributor',
  '28 team members added as contributors');
select is((select role::text from project_members where project_id = tests.u('p1') and user_id = tests.u('G')), 'viewer',
  '29 guests are forced to viewer');

-- Workspace admin acts as lead; contributor cannot edit project settings.
select tests.claims(tests.u('A')); set local role authenticated;
select is(project_role_of(tests.u('p1'))::text, 'lead', '30 workspace admin acts as lead');
reset role;
select tests.claims(tests.u('M')); set local role authenticated;
update projects set name = 'Hijacked' where id = tests.u('p1');
select is_empty($$select 1 from projects where id = tests.u('prv')$$, '31 private project invisible to non-member');
select is_empty($$select 1 from search_workspace(tests.u('ws1'), 'Secret')$$, '32 private project hidden from search');
select throws_ok($$insert into milestones (project_id, name) values (tests.u('p1'), 'Mine')$$, '42501', null,
  '33 contributor cannot create milestones');
reset role;
select is((select name from projects where id = tests.u('p1')), 'Capstone', '34 contributor cannot rename the project');

-- ============================== Tasks =========================================================
select tests.claims(tests.u('M')); set local role authenticated;
insert into tasks (project_id, title) values (tests.u('p1'), 'First'), (tests.u('p1'), 'Second'), (tests.u('p1'), 'Third');
reset role;
select results_eq($$select number from tasks where project_id = tests.u('p1') and title in ('First','Second','Third') order by number$$,
  $$values (17), (18), (19)$$, '35 task numbers are sequential per project');
insert into tests.vars select 't1', id::text from tasks where project_id = tests.u('p1') and title = 'First';
insert into tests.vars select 't2', id::text from tasks where project_id = tests.u('p1') and title = 'Second';
insert into tests.vars select 't3', id::text from tasks where project_id = tests.u('p1') and title = 'Third';
select is((select created_by from tasks where id = tests.u('t1')), tests.u('M'), '36 created_by forced to the caller');
select is((select count(*)::int from task_status_history where task_id = tests.u('t1') and from_status is null), 1,
  '37 history row written on insert');

select tests.claims(tests.u('M')); set local role authenticated;
update tasks set status = 'in_progress' where id = tests.u('t1');
update tasks set status = 'done' where id = tests.u('t1');
reset role;
select is((select count(*)::int from task_status_history where task_id = tests.u('t1')), 3, '38 history row per status change');
select isnt((select completed_at from tasks where id = tests.u('t1')), null, '39 completed_at set on done');
select tests.claims(tests.u('M')); set local role authenticated;
update tasks set status = 'todo' where id = tests.u('t1');
select throws_ok($$update tasks set number = 999 where id = tests.u('t1')$$, '42501', null, '40 task number is immutable');
reset role;
select is((select completed_at from tasks where id = tests.u('t1')), null, '41 completed_at cleared when reopened');

-- Blocked rule
update tasks set is_blocked = true, blocked_reason = 'Waiting on API' where id = tests.u('t2');
select tests.claims(tests.u('M')); set local role authenticated;
select throws_like($$select move_task(tests.u('t2'), 'done')$$, 'TASK_BLOCKED:%', '42 contributor cannot complete a blocked task');
select throws_ok($$select move_task(tests.u('t2'), 'done', null, null, 'please')$$, '42501', null, '43 contributor cannot override');
reset role;
select tests.claims(tests.u('O')); set local role authenticated;
select lives_ok($$select move_task(tests.u('t2'), 'done', null, null, 'Client approved')$$, '44 lead can override with a reason');
reset role;
select is((select metadata ->> 'override_reason' from activity_logs where task_id = tests.u('t2') and action = 'task.status_changed'
            order by id desc limit 1), 'Client approved', '45 override reason logged');

-- Subtasks rule
select tests.claims(tests.u('M')); set local role authenticated;
insert into tasks (project_id, parent_task_id, title) values (tests.u('p1'), tests.u('t3'), 'Sub of third');
select throws_like($$update tasks set status = 'done' where id = tests.u('t3')$$, 'SUBTASKS_OPEN:%', '46 parent cannot be done with open subtasks');
select throws_ok($$insert into tasks (project_id, parent_task_id, title) values (tests.u('p1'), (select id from tasks where title = 'Sub of third'), 'Nested')$$,
  '23514', null, '47 only one level of subtasks');
reset role;

-- move_task renormalisation keeps order
update tasks set status = 'in_review', position = 1 where id = tests.u('t1');
update tasks set status = 'in_review', position = 1.00000000001 where id = tests.u('t3');
update tasks set status = 'in_review', position = 5000 where id = (select id from tasks where title = 'Sub of third');
select tests.claims(tests.u('M')); set local role authenticated;
insert into tests.vars select 'moved', id::text from tasks where project_id = tests.u('p1') and status = 'backlog' order by number limit 1;
select lives_ok($$select move_task(tests.u('moved'), 'in_review', 1, 1.00000000001)$$, '48 move between near-equal positions');
reset role;
select results_eq(
  $$select id from tasks where project_id = tests.u('p1') and status = 'in_review' order by position$$,
  $$values (tests.u('t1')), (tests.u('moved')), (tests.u('t3')), ((select id from tasks where title = 'Sub of third'))$$,
  '49 renormalisation preserves order with the moved task between its neighbours');

-- Assignments
select tests.claims(tests.u('M')); set local role authenticated;
select throws_ok($$select set_task_assignees(tests.u('t3'), array[tests.u('V')])$$, '23514', null, '50 viewer cannot be assigned');
select throws_ok($$select set_task_assignees(tests.u('t3'), array[tests.u('W')])$$, '23514', null, '51 outsider cannot be assigned');
select set_task_assignees(tests.u('t3'), array[tests.u('O'), tests.u('M')]);
reset role;
select is((select count(*)::int from notifications where user_id = tests.u('O') and type = 'task_assigned' and entity_id = tests.u('t3')), 1,
  '52 assignee notified');
select is((select count(*)::int from notifications where user_id = tests.u('M') and type = 'task_assigned'), 0,
  '53 actor not notified about own action');
update profiles set notification_prefs = '{"task_assigned": false}' where id = tests.u('O');
select tests.claims(tests.u('M')); set local role authenticated;
select set_task_assignees(tests.u('t1'), array[tests.u('O')]);
reset role;
select is((select count(*)::int from notifications where user_id = tests.u('O') and type = 'task_assigned' and entity_id = tests.u('t1')), 0,
  '54 notification preferences respected');

-- Viewer: no task writes, but can comment
select tests.claims(tests.u('V')); set local role authenticated;
select throws_ok($$insert into tasks (project_id, title) values (tests.u('p1'), 'Viewer task')$$, '42501', null, '55 viewer cannot create tasks');
update tasks set title = 'Viewer edit' where id = tests.u('t1');
select lives_ok($$insert into comments (task_id, body) values (tests.u('t1'), 'Looks good')$$, '56 viewer can comment');
reset role;
select isnt((select title from tasks where id = tests.u('t1')), 'Viewer edit', '57 viewer cannot update tasks');

-- Comments & mentions
select tests.claims(tests.u('M')); set local role authenticated;
insert into comments (task_id, body)
values (tests.u('t3'), 'Hey @' || tests.v('o_handle') || ' and @' || tests.v('w_handle') || ' please check');
reset role;
select results_eq($$select user_id from comment_mentions cm join comments c on c.id = cm.comment_id where c.task_id = tests.u('t3')$$,
  $$values (tests.u('O'))$$, '58 mentions only resolve to project members');
select is((select count(*)::int from notifications where user_id = tests.u('O') and type = 'mentioned'), 1, '59 mentioned user notified');
select is((select count(*)::int from notifications where user_id = tests.u('O') and type = 'comment_on_assigned' and entity_id = tests.u('t3')), 0,
  '60 mentioned assignee not double-notified');

-- Clients cannot write server-owned tables
select tests.claims(tests.u('M')); set local role authenticated;
select throws_ok($$insert into activity_logs (workspace_id, action, entity_type) values (tests.u('ws1'), 'fake', 'x')$$, '42501', null,
  '61 clients cannot insert activity_logs');
select throws_ok($$insert into notifications (user_id, workspace_id, type, title) values (tests.u('O'), tests.u('ws1'), 'mentioned', 'x')$$, '42501', null,
  '62 clients cannot insert notifications');
select throws_ok($$insert into task_status_history (task_id, project_id, workspace_id, to_status) values (tests.u('t1'), tests.u('p1'), tests.u('ws1'), 'done')$$, '42501', null,
  '63 clients cannot insert task_status_history');
reset role;
select tests.claims(tests.u('O')); set local role authenticated;
select throws_ok($$update notifications set title = 'changed' where user_id = tests.u('O')$$, '42501', null, '64 only read_at is updatable');
select lives_ok($$update notifications set read_at = now() where user_id = tests.u('O')$$, '65 user can mark own notifications read');
reset role;

-- Search by key
select tests.claims(tests.u('M')); set local role authenticated;
select is((select id from search_workspace(tests.u('ws1'), 'cap-17') where kind = 'task'), tests.u('t1'), '66 search finds a task by key');
reset role;

-- Delete permissions
select tests.claims(tests.u('X')); set local role authenticated;
select throws_ok($$select delete_task(tests.u('t1'))$$, '42501', null, '67 non-creator contributor cannot delete');
reset role;
select tests.claims(tests.u('O')); set local role authenticated;
select lives_ok($$select delete_task(tests.u('t1'))$$, '68 lead can delete any task');
select is_empty($$select 1 from tasks where id = tests.u('t1')$$, '69 soft-deleted tasks are hidden');
reset role;

-- Isolation: outsider W sees nothing of ws1 and cannot write
select tests.claims(tests.u('W')); set local role authenticated;
select is_empty($$
  select 1 from projects where workspace_id = tests.u('ws1')
  union all select 1 from tasks where workspace_id = tests.u('ws1')
  union all select 1 from milestones where workspace_id = tests.u('ws1')
  union all select 1 from labels where workspace_id = tests.u('ws1')
  union all select 1 from project_members where workspace_id = tests.u('ws1')
  union all select 1 from task_assignees where workspace_id = tests.u('ws1')
  union all select 1 from task_status_history where workspace_id = tests.u('ws1')
  union all select 1 from comments where workspace_id = tests.u('ws1')
  union all select 1 from activity_logs where workspace_id = tests.u('ws1')
  union all select 1 from teams where workspace_id = tests.u('ws1')
  union all select 1 from team_members where workspace_id = tests.u('ws1')
  union all select 1 from workspace_invitations where workspace_id = tests.u('ws1')
  union all select 1 from notifications where workspace_id = tests.u('ws1')
  union all select 1 from attachments where workspace_id = tests.u('ws1')
$$, '70 outsider sees zero rows in every Phase 2 table');
select is_empty($$select 1 from search_workspace(tests.u('ws1'), 'Capstone')$$, '71 outsider search returns nothing');
select throws_ok($$insert into tasks (project_id, title) values (tests.u('p1'), 'Intruder')$$, '42501', null, '72 outsider cannot insert tasks');
select throws_ok($$select move_task(tests.u('t3'), 'done')$$, 'P0002', null, '73 outsider cannot move tasks (not found)');
reset role;

-- Storage: attachment objects follow project visibility
insert into storage.objects (bucket_id, name)
values ('attachments', tests.v('ws1') || '/' || tests.v('p1') || '/' || tests.v('t3') || '/x-file.pdf');
select tests.claims(tests.u('W')); set local role authenticated;
select is_empty($$select 1 from storage.objects where bucket_id = 'attachments'$$, '74 outsider cannot read attachment objects');
reset role;
select tests.claims(tests.u('V')); set local role authenticated;
select isnt_empty($$select 1 from storage.objects where bucket_id = 'attachments'$$, '75 project viewer can read attachment objects');
reset role;

-- Due-date notifications idempotent
update tasks set due_date = current_date + 1 where id = tests.u('t3');
select is((select due_soon from generate_due_notifications(current_date)), 2, '76 due_soon generated for each assignee');
select is((select due_soon from generate_due_notifications(current_date)), 0, '77 second run for the same date creates nothing');

-- Removing a member cascades team & project membership
select tests.claims(tests.u('O')); set local role authenticated;
select remove_member(tests.u('ws1'), tests.u('M'));
reset role;
select is((select count(*)::int from project_members where user_id = tests.u('M')) + (select count(*)::int from team_members where user_id = tests.u('M'))
          + (select count(*)::int from task_assignees ta join tasks t on t.id = ta.task_id where ta.user_id = tests.u('M') and t.status not in ('done','cancelled')),
  0, '78 removed member loses team, project and open assignments');

select * from finish();
rollback;
