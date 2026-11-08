# Supabase (database, auth, storage)

- `migrations/` — timestamped SQL migrations (never edit one that has been applied; add a new one).
- `tests/` — pgTAP suites run with `npm run db:test` (`supabase test db`). They create their own
  users inside a transaction that is rolled back, so they do not depend on the seed.
- `seed.sql` — **local only** (applied by `supabase db reset`).

## Local test accounts (local stack only — these do not exist in any hosted project)

| Email | Password |
|---|---|
| alice@teamsync.test | Password123 |
| bob@teamsync.test | Password123 |

Both are confirmed and have no workspace, so logging in takes you to onboarding.

## Commands

```bash
npm run db:start     # supabase start (requires Docker)
npm run db:reset     # re-apply all migrations + seed
npm run db:test      # pgTAP suites
npm run gen:types    # regenerate src/types/database.ts from the local schema
```

Local emails (confirmation / password reset) are captured by the local mail catcher at
http://127.0.0.1:54324.
