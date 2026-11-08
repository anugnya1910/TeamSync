-- Phase 3 pgTAP suite: dependencies, gamification, workload, snapshots, AI quotas, isolation.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

create schema tests;
create table tests.vars (k text primary key, v text);
grant usage on schema tests to anon, authenticated;
grant all on tests.vars to anon, authenticated;
create function tests.v(p text) returns text language sql stable as $$ select v from tests.vars where k = p $$;
create function tests.u(p text) returns uuid language sql stable as $$ select v::uuid from tests.vars where k = p $$;
create function tests.claims(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('30000000-0000-4000-8000-000000000001', 'lead3@t.dev', '{"full_name":"Lena Lead"}', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000002', 'contrib3@t.dev', '{"full_name":"Chen Contributor"}', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000003', 'viewer3@t.dev', '{"full_name":"Vera Viewer"}', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000004', 'outsider3@t.dev', '{"full_name":"Omar Outsider"}', 'authenticated', 'authenticated');
insert into tests.vars values
  ('L', '30000000-0000-4000-8000-000000000001'), ('C', '30000000-0000-4000-8000-000000000002'),
  ('V', '30000000-0000-4000-8000-000000000003'), ('W', '30000000-0000-4000-8000-000000000004');

select tests.claims(tests.u('L')); set local role authenticated;
insert into tests.vars select 'ws', (create_workspace('Gamma', 'gamma-p3')).id::text;
reset role;
insert into workspace_members (workspace_id, user_id, role) values
  (tests.u('ws'), tests.u('C'), 'member'), (tests.u('ws'), tests.u('V'), 'member');
select tests.claims(tests.u('W')); set local role authenticated;
insert into tests.vars select 'ws2', (create_workspace('Delta', 'delta-p3')).id::text;
reset role;

select tests.claims(tests.u('L')); set local role authenticated;
insert into tests.vars select 'p', (create_project(tests.u('ws'), 'Intel', 'INT')).id::text;
insert into tests.vars select 'p2', (create_project(tests.u('ws'), 'Other', 'OTH')).id::text;
select set_project_member(tests.u('p'), tests.u('C'), 'contributor', 20);
select set_project_member(tests.u('p'), tests.u('V'), 'viewer', 20);
insert into tasks (project_id, title) select tests.u('p'), 'T' || g from generate_series(1, 7) g;
insert into tasks (project_id, title) values (tests.u('p2'), 'Elsewhere');
reset role;
insert into tests.vars select 't' || number, id::text from tasks where project_id = tests.u('p');
insert into tests.vars select 'x', id::text from tasks where project_id = tests.u('p2');

-- ============================== Dependencies ==================================================
select tests.claims(tests.u('C')); set local role authenticated;
select lives_ok($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t1'), tests.u('t2'))$$, '1 contributor adds a dependency');
select throws_ok($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t1'), tests.u('t2'))$$, '23505', null, '2 duplicate dependency rejected');
select throws_like($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t2'), tests.u('t1'))$$, 'CYCLE_DETECTED:%', '3 direct cycle rejected');
insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t2'), tests.u('t3'));
select throws_like($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t3'), tests.u('t1'))$$, 'CYCLE_DETECTED:%', '4 indirect cycle rejected');
select throws_like($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t1'), tests.u('t1'))$$, 'CYCLE_DETECTED:%', '5 self dependency rejected');
select throws_ok($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t1'), tests.u('x'))$$, '23514', null, '6 cross-project dependency rejected');
select is((select effectively_blocked from v_task_effective where id = tests.u('t2')), true, '7 view marks blocked task');
select is((select blocking_open_count from v_task_effective where id = tests.u('t1')), 1, '8 view counts open tasks blocked by t1');
select throws_like($$select move_task(tests.u('t2'), 'done')$$, 'TASK_BLOCKED:%', '9 contributor cannot complete an effectively blocked task');
update tasks set status = 'done' where id = tests.u('t1');
select is((select effectively_blocked from v_task_effective where id = tests.u('t2')), false, '10 completing the blocker unblocks');
reset role;
select ok((select prosrc like '%pg_advisory_xact_lock%' from pg_proc where proname = 'prevent_dependency_cycle'), '11 cycle check takes a per-project advisory lock');
select tests.claims(tests.u('V')); set local role authenticated;
select throws_ok($$insert into task_dependencies (blocker_task_id, blocked_task_id) values (tests.u('t4'), tests.u('t5'))$$, '42501', null, '12 viewer cannot add dependencies');
reset role;

-- ============================== Gamification ==================================================
-- t1 was completed by C (unassigned → completer gets XP).
select is((select count(*)::int from xp_events where source_id = tests.u('t1') and user_id = tests.u('C') and event_type = 'task_completed:1'), 1,
  '13 completer awarded XP for an unassigned task');
select tests.claims(tests.u('L')); set local role authenticated;
select set_task_assignees(tests.u('t4'), array[tests.u('C')]);
reset role;
select tests.claims(tests.u('C')); set local role authenticated;
update tasks set status = 'done' where id = tests.u('t4');
update tasks set status = 'done' where id = tests.u('t4');
reset role;
select is((select count(*)::int from xp_events where source_id = tests.u('t4') and event_type like 'task_completed:%'), 1, '14 repeated update does not double award');
insert into tests.vars select 'xp4', xp::text from xp_events where source_id = tests.u('t4') and event_type = 'task_completed:1';
select ok(tests.v('xp4')::int > 0, '15 assignee received positive XP');
select tests.claims(tests.u('C')); set local role authenticated;
update tasks set status = 'todo' where id = tests.u('t4');
reset role;
select is((select xp from xp_events where source_id = tests.u('t4') and event_type = 'task_reopened:1'), -tests.v('xp4')::int, '16 reopening compensates the award');
select tests.claims(tests.u('C')); set local role authenticated;
update tasks set status = 'done' where id = tests.u('t4');
reset role;
select is((select count(*)::int from xp_events where source_id = tests.u('t4') and event_type = 'task_completed:2'), 1, '17 re-completion awards a new cycle');
select is((select count(*)::int from user_achievements where user_id = tests.u('C') and achievement_code = 'first_task'), 1, '18 first_task unlocked exactly once');
select is((select count(*)::int from notifications where user_id = tests.u('C') and type = 'achievement_unlocked'), 1, '19 achievement notification sent once');
select ok((select current_streak >= 1 from user_streaks where user_id = tests.u('C') and workspace_id = tests.u('ws')), '20 streak recorded');

select tests.claims(tests.u('C')); set local role authenticated;
select throws_ok($$insert into xp_events (workspace_id, user_id, source_type, source_id, event_type, xp) values (tests.u('ws'), tests.u('C'), 'task', gen_random_uuid(), 'fake', 9999)$$, '42501', null, '21 clients cannot insert XP');
select throws_ok($$update user_streaks set current_streak = 999$$, '42501', null, '22 clients cannot edit streaks');
select throws_ok($$insert into user_achievements (user_id, workspace_id, achievement_code) values (tests.u('C'), tests.u('ws'), 'fifty_tasks')$$, '42501', null, '23 clients cannot grant achievements');
select is((select is_self from get_leaderboard(tests.u('ws'), 'all') where user_id = tests.u('C')), true, '24 leaderboard flags own row');
reset role;

select ok(insert_xp(tests.u('ws'), tests.u('C'), 'task', gen_random_uuid(), 'cap-test', 600) <= 500, '25 daily cap limits a single award');
select is((select metadata ->> 'capped' from xp_events where event_type = 'cap-test'), 'true', '26 capped award is flagged');

select tests.claims(tests.u('L')); set local role authenticated;
update workspaces set gamification_enabled = false where id = tests.u('ws');
update tasks set status = 'done' where id = tests.u('t7');
update workspaces set gamification_enabled = true where id = tests.u('ws');
reset role;
select is((select count(*)::int from xp_events where source_id = tests.u('t7')), 0, '27 no XP while gamification is disabled');

-- ============================== Workload ======================================================
select tests.claims(tests.u('L')); set local role authenticated;
select set_task_assignees(tests.u('t5'), array[tests.u('C')]);
select set_task_assignees(tests.u('t6'), array[tests.u('C')]);
reset role;
select tests.claims(tests.u('C')); set local role authenticated;
select throws_ok($$select save_workload_recommendations(tests.u('p'), '[]'::jsonb)$$, '42501', null, '28 contributor cannot save suggestions');
reset role;
select tests.claims(tests.u('L')); set local role authenticated;
select is(save_workload_recommendations(tests.u('p'), jsonb_build_array(
  jsonb_build_object('task_id', tests.v('t5'), 'from_user_id', tests.v('C'), 'to_user_id', tests.v('L'), 'reason', 'test', 'imbalance_before', 0.5, 'imbalance_after', 0.2),
  jsonb_build_object('task_id', tests.v('t6'), 'from_user_id', tests.v('C'), 'to_user_id', tests.v('L'), 'reason', 'test', 'imbalance_before', 0.5, 'imbalance_after', 0.3))), 2,
  '29 lead saves suggestions');
reset role;
insert into tests.vars select 'r5', id::text from workload_recommendations where task_id = tests.u('t5');
insert into tests.vars select 'r6', id::text from workload_recommendations where task_id = tests.u('t6');
select tests.claims(tests.u('C')); set local role authenticated;
select throws_ok($$select apply_workload_recommendation(tests.u('r5'))$$, '42501', null, '30 only leads can apply');
update tasks set status = 'in_progress' where id = tests.u('t6');
reset role;
select tests.claims(tests.u('L')); set local role authenticated;
select lives_ok($$select apply_workload_recommendation(tests.u('r5'))$$, '31 lead applies a suggestion');
select is((select apply_workload_recommendation(tests.u('r6')) is null), true, '32 stale suggestion is not applied');
reset role;
select results_eq($$select user_id from task_assignees where task_id = tests.u('t5')$$, $$values (tests.u('L'))$$, '33 reassignment is atomic');
select is((select status from workload_recommendations where id = tests.u('r6')), 'stale', '34 stale suggestion is marked stale');

-- ============================== Snapshots =====================================================
select tests.claims(tests.u('V')); set local role authenticated;
select throws_like($$select upsert_health_snapshot(tests.u('p'), current_date, 80::smallint, 'healthy', '[{"points":30},{"points":20}]', '{}')$$,
  'VALIDATION:%', '35 inconsistent factor sum rejected');
select lives_ok($$select upsert_health_snapshot(tests.u('p'), current_date, 50::smallint, 'at_risk', '[{"points":30},{"points":20}]', '{"open_tasks":3}')$$,
  '36 viewer records a lazy snapshot for a visible project');
reset role;
select tests.claims(tests.u('W')); set local role authenticated;
select throws_ok($$select upsert_health_snapshot(tests.u('p'), current_date, 50::smallint, 'at_risk', '[{"points":50}]', '{}')$$, 'P0002', null,
  '37 outsider cannot write snapshots');
reset role;

-- ============================== AI quotas =====================================================
select tests.claims(tests.u('C')); set local role authenticated;
select is((select allowed from consume_ai_quota(tests.u('ws'), 'breakdown')), true, '38 quota allows the first request');
reset role;
insert into ai_requests (workspace_id, user_id, action, source, status)
select tests.u('ws'), tests.u('C'), 'summary', 'ai', 'ok' from generate_series(1, 19);
select tests.claims(tests.u('C')); set local role authenticated;
select is((select reason from consume_ai_quota(tests.u('ws'), 'breakdown')), 'user_limit', '39 per-user daily limit enforced');
reset role;
update workspaces set ai_enabled = false where id = tests.u('ws');
select tests.claims(tests.u('L')); set local role authenticated;
select is((select reason from consume_ai_quota(tests.u('ws'), 'summary')), 'disabled', '40 disabled workspace falls back');
reset role;

-- ============================== Isolation =====================================================
select tests.claims(tests.u('W')); set local role authenticated;
select throws_ok($$select * from consume_ai_quota(tests.u('ws'), 'summary')$$, 'P0002', null, '41 outsider cannot use another workspace''s AI quota');
select is_empty($$
  select 1 from task_dependencies where project_id = tests.u('p')
  union all select 1 from project_health_snapshots where project_id = tests.u('p')
  union all select 1 from workload_recommendations where project_id = tests.u('p')
  union all select 1 from xp_events where workspace_id = tests.u('ws')
  union all select 1 from user_streaks where workspace_id = tests.u('ws')
  union all select 1 from user_achievements where workspace_id = tests.u('ws')
  union all select 1 from ai_requests where workspace_id = tests.u('ws')
  union all select 1 from v_member_stats where workspace_id = tests.u('ws')
$$, '42 outsider sees zero rows in every Phase 3 table');
reset role;

select * from finish();
rollback;
