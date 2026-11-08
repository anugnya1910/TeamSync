-- Phase 1 pgTAP suite: RLS, triggers, RPCs, storage (PHASE_1 Step 5).
-- Runs inside a transaction that is rolled back. Impersonation pattern:
--   select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
--   set local role authenticated;   ...   reset role;
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

-- Fixtures: A = aaaaaaaa…, B = bbbbbbbb…  (profiles are created by handle_new_user)
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice.Example+tag@test.dev', '{"full_name":"Alice A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@test.dev', '{"name":"Bob B","avatar_url":"https://example.com/b.png"}', 'authenticated', 'authenticated');

-- 1–3: RLS enabled
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass), 'RLS enabled on workspaces');
select ok((select relrowsecurity from pg_class where oid = 'public.workspace_members'::regclass), 'RLS enabled on workspace_members');

-- 4–7: handle_new_user
select is((select full_name from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Alice A', 'profile created with full_name from metadata');
select matches((select handle::text from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '^aliceexampletag_[0-9]{4}$', 'handle = sanitised email prefix + 4 digits');
select is((select full_name from profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Bob B', 'falls back to `name` metadata');
select matches((select handle::text from profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), '^b00_[0-9]{4}$', 'short email prefix padded to 3 chars');

-- 8: invalid timezone rejected
select throws_like(
  $$update profiles set timezone = 'Mars/Olympus' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'VALIDATION: unknown timezone%', 'unknown timezone rejected');

-- ---------- as A ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;

update profiles set job_title = 'Team lead' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update profiles set job_title = 'Hacked' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- 9: cannot change immutable column
select throws_ok(
  $$update profiles set onboarded_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', null, 'onboarded_at not directly updatable');

-- 10: complete_onboarding
select is(
  (select (complete_onboarding('Alice Anand', 'PM', 'Europe/London', null)).timezone),
  'Europe/London', 'complete_onboarding updates profile');

-- 11: create_workspace
select lives_ok($$select create_workspace('Alpha Team', 'alpha-team')$$, 'A creates workspace via RPC');
-- 12
select is(
  (select role::text from workspace_members m join workspaces w on w.id = m.workspace_id where w.slug = 'alpha-team'),
  'owner', 'creator is owner member');
-- 13
select is((select last_workspace_id from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  (select id from workspaces where slug = 'alpha-team'), 'last_workspace_id set by create_workspace');
-- 14
select is(is_slug_available('alpha-team'), false, 'taken slug reported unavailable');
-- 15
select is(is_slug_available('Bad Slug!'), false, 'invalid slug reported unavailable');
-- 16: direct insert denied
select throws_ok(
  $$insert into workspaces (name, slug, owner_id) values ('Direct', 'direct-ws', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501', null, 'direct INSERT into workspaces is denied');
-- 17: owner (admin) can rename
update workspaces set name = 'Alpha Squad' where slug = 'alpha-team';
select is((select name from workspaces where slug = 'alpha-team'), 'Alpha Squad', 'owner can update workspace name');
-- 18: owner_id immutable for clients
select throws_ok(
  $$update workspaces set owner_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where slug = 'alpha-team'$$,
  '42501', null, 'owner_id not updatable');

reset role;

-- 19–20: own update applied, foreign update silently filtered by RLS
select is((select job_title from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'PM', 'A updated own profile');
select is((select job_title from profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null, 'A could not update B''s profile');

-- ---------- as B (no shared workspace) ----------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;

-- 21–23
select is_empty($$select 1 from workspaces where slug = 'alpha-team'$$, 'B cannot see A''s workspace');
select is_empty($$select 1 from workspace_members where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'B cannot see A''s memberships');
select is_empty($$select 1 from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'B cannot see A''s profile without a shared workspace');
-- 24
select throws_like($$select create_workspace('Copycat', 'alpha-team')$$, 'CONFLICT:%', 'duplicate slug raises CONFLICT');
-- 25: set_last_workspace ignores non-member workspaces
select set_last_workspace((select id from workspaces where slug = 'alpha-team'));
reset role;
select is((select last_workspace_id from profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), null, 'set_last_workspace ignores workspaces the user is not in');

-- 26: sharing a workspace makes profiles mutually visible
insert into workspace_members (workspace_id, user_id, role)
values ((select id from workspaces where slug = 'alpha-team'), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select isnt_empty($$select 1 from profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'shared workspace makes A''s profile visible to B');
reset role;

-- 27: anon cannot execute helpers
set local role anon;
select throws_ok($$select public.is_workspace_member(gen_random_uuid())$$, '42501', null, 'anon cannot execute RLS helpers');
reset role;

-- 28–29: owner protections (as postgres — triggers apply to everyone)
select throws_ok(
  $$delete from workspace_members where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and workspace_id = (select id from workspaces where slug = 'alpha-team')$$,
  '42501', null, 'owner row cannot be deleted');
select throws_ok(
  $$update workspace_members set role = 'owner' where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '42501', null, 'second owner cannot be created');

-- 30: storage — upload outside own folder is rejected
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar.webp')$$,
  '42501', null, 'avatar upload into another user''s folder is rejected');
reset role;

select * from finish();
rollback;
