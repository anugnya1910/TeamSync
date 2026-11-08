-- LOCAL DEVELOPMENT ONLY — applied by `supabase db reset` against the local stack.
-- Never run against production. Creates two confirmed users and nothing else (no workspaces,
-- no tasks, no metrics) so that no fabricated analytics can ever appear.
-- Credentials are documented in supabase/README.md.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated',
   'authenticated', 'alice@teamsync.test', extensions.crypt('Password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Alice Local"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated',
   'authenticated', 'bob@teamsync.test', extensions.crypt('Password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bob Local"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   '{"sub":"11111111-1111-4111-8111-111111111111","email":"alice@teamsync.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
   '{"sub":"22222222-2222-4222-8222-222222222222","email":"bob@teamsync.test","email_verified":true}', 'email', now(), now(), now())
on conflict do nothing;
