# TeamSync

> Plan smarter. Collaborate better. Deliver together.

TeamSync is a multi-tenant project and task manager for student and small teams, with an
explainable **Project Pulse** health score, workload balancing, dependency mapping and real-time
collaboration — running entirely on free tiers (Supabase Free, Vercel Hobby, GitHub Actions).

Built with Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase
(PostgreSQL + RLS, Auth, Realtime, Storage).

## Quick start (local)

Requirements: Node.js 22+ (LTS), npm, Docker Desktop (for the local Supabase stack).

```bash
npm install
cp .env.example .env.local          # then fill in values printed by `supabase start`
npm run db:start                    # local Supabase (Docker)
npm run db:reset                    # apply migrations + local-only seed
npm run gen:types                   # regenerate src/types/database.ts
npm run dev                         # http://localhost:3000
```

Local test accounts are listed in [`supabase/README.md`](supabase/README.md).

## Scripts

| Script | Purpose |
|---|---|
| `npm run lint` / `typecheck` / `test` / `build` | Quality gates (run in CI) |
| `npm run test:e2e` | Playwright (set `E2E_SUPABASE=1` with a running local Supabase for the full suite) |
| `npm run db:test` | pgTAP database tests (`supabase test db`) |

## Documentation

- Specification and phase plans: [`docs/planning/`](docs/planning/)
- Implementation status: [`docs/planning/IMPLEMENTATION_TRACKER.md`](docs/planning/IMPLEMENTATION_TRACKER.md)
- Screenshots: [`docs/screenshots/`](docs/screenshots/)

_Built for academic purposes._
