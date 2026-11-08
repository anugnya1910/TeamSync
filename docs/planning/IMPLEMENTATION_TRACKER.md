# TeamSync — Implementation Tracker

> Update this file at the **end of every development session**. Claude Code must update it before reporting a phase complete.
> Status legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked · ➖ Deferred (Advanced tier / future)
> Source of truth for scope: `PROJECT_SPECIFICATION.md`.

---

## 1. Project Snapshot

| Field | Value |
|---|---|
| Current phase | Phase 1 — Foundation & UI |
| Overall status | 🟨 Phase 1 implemented; CI database/e2e verification pending |
| Last updated | 2026-11-08 (IST) by Claude Code for anugnya |
| Repository | https://github.com/anugnya1910/TeamSync |
| Production URL | — (fill **only** after verified deployment) |
| Preview URL | — |
| Supabase prod project ref | — |
| Supabase dev | ✅ Local Docker stack in CI (GitHub Actions). The developer machine has no Docker, so migrations are run there only by CI and a PGlite harness (see §11) |
| Latest release tag | — |

## 2. Phase Status

| Phase | Status | Started | Completed | Acceptance criteria passed | Notes |
|---|---|---|---|---|---|
| 1 — Foundation & UI | 🟨 | 2026-11-08 | | see §4 | Local gates green; DB + Supabase e2e verified only in CI |
| 2 — Core Full-Stack | ⬜ | | | 0 / 14 | |
| 3 — Intelligence & Innovation | ⬜ | | | 0 / 12 | |
| 4 — Testing & Deployment | ⬜ | | | 0 / 14 | |

## 3. Session Log

| Date | Phase | Summary of work | Commits | Next step |
|---|---|---|---|---|
| 2026-11-08 | 1 | Scaffold (Next 16.4, Tailwind 4, shadcn radix-nova), design system, 5 migrations + pgTAP (30 assertions), auth, onboarding, app shell, dashboard, settings, landing, security headers, Vitest (104) + Playwright, CI | `feat(phase1)` | Verify CI (pgTAP + e2e with Supabase), then Phase 2 |

---

## 4. Phase Checklists

### Phase 1 — Foundation & UI

**Setup**
- [x] Next.js + TS strict + Tailwind + ESLint + Prettier scaffold
- [x] Runtime & dev dependencies installed (versions recorded in §10)
- [x] shadcn/ui initialised + primitives added
- [x] Folder structure per spec §C.3
- [x] Scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `db:*`, `gen:types`)
- [x] `.env.example`, `.gitignore`, `src/lib/env.ts` validation
- [x] Planning docs moved to `docs/planning/`

**Design system**
- [x] Fonts (Bricolage Grotesque, Inter, JetBrains Mono)
- [x] Colour tokens light/dark (§F.2) mapped to Tailwind
- [x] Theme provider, no flash
- [x] Motion tokens + reduced-motion hook
- [x] Brand components: Logo, PulseRing, SyncLine, GrainOverlay, StatusIcon, PriorityIcon, EmptyState, ComingSoon
- [x] `/dev/design` page + contrast check + screenshots

**Supabase & DB**
- [x] Browser/server/middleware clients; admin client server-only
- [x] Migration `p1_extensions_enums`
- [x] Migration `p1_profiles` (+ `handle_new_user`)
- [x] Migration `p1_workspaces_core` (+ RPCs)
- [x] Migration `p1_rls_helpers`
- [x] Migration `p1_storage_avatars`
- [ ] Types generated — hand-written in generator format; CI regenerates from the real schema and re-typechecks (pending first CI run)
- [ ] pgTAP Phase 1 suite (≥ 12) — written (30 assertions), passes in local PGlite harness; awaiting real `supabase test db` in CI

**Auth & onboarding**
- [x] Login / Signup / Forgot / Reset / Callback
- [x] Google OAuth (flagged)
- [x] Middleware route protection + safe `next`
- [x] Post-login resolver
- [x] Onboarding wizard (profile, workspace, finish)

**App shell & pages**
- [x] Sidebar (collapsible) + workspace switcher + create workspace
- [x] Topbar, breadcrumbs, bell placeholder
- [x] Mobile bottom nav + drawer
- [x] Command palette (navigation commands)
- [x] Shortcuts dialog
- [x] Later-phase routes show ComingSoon
- [x] Dashboard shell (real data only)
- [x] Settings: profile, preferences, security
- [x] Landing page (hero, bento, Pulse formula demo, FAQ, footer, SEO)

**Security, tests, CI, deploy**
- [x] Security headers + CSP
- [x] ESLint restriction on admin client import
- [x] Vitest unit/component tests
- [ ] Playwright: landing, auth-onboarding, responsive, protected routes (+ axe) — 52 runs pass locally across desktop-chrome + mobile-safari; 12 Supabase-dependent runs skipped locally, run in CI
- [x] GitHub Actions CI (+ pgTAP job) + gitleaks
- [ ] Supabase prod project + `db push` — ⛔ needs the student's Supabase account (see §12)
- [ ] Vercel preview/production deploy (verified) — ⛔ needs the student's Vercel account (see §12)

**Phase 1 acceptance:** AC1 ✅ (local) AC2 🟨 CI AC3 🟨 CI AC4 🟨 CI AC5 🟨 partial (redirects ✅ local; session/logout in CI) AC6 🟨 CI AC7 ✅ (29/29 contrast pairs both themes, screenshots) AC8 🟨 (public pages ✅ local; app pages CI) AC9 🟨 (landing + auth ✅ local; onboarding/dashboard CI) AC10 ✅ AC11 ✅ AC12 ⬜ (Lighthouse not yet run) AC13 ✅

### Phase 2 — Core Full-Stack Application

**Database**
- [ ] M1 `p2_invitations_membership`
- [ ] M2 `p2_teams`
- [ ] M3 `p2_projects` (+ helpers, templates)
- [ ] M4 `p2_tasks` (+ numbering, history, move_task, assignees, bulk)
- [ ] M5 `p2_collaboration` (+ attachments bucket)
- [ ] M6 `p2_activity_notifications`
- [ ] M7 `p2_search`
- [ ] M8 `p2_realtime`
- [ ] M9 `p2_daily_jobs_base`

**Backend**
- [ ] `ActionResult` + `mapPgError`
- [ ] zod schemas for all Phase 2 actions
- [ ] Server Actions (workspace, team, project, task, comment, notification, view)
- [ ] `/api/export/tasks.csv`
- [ ] `/api/cron/daily` + `/api/health`
- [ ] `daily.yml` workflow

**Frontend**
- [ ] Members & invites; `/invite/[token]`; workspace settings & danger zone
- [ ] Teams pages
- [ ] Projects list + new project dialog (templates)
- [ ] Project layout, overview, settings (members, capacity, labels, WIP)
- [ ] Task quick create + dialog + `parseQuickDate`
- [ ] Task sheet + full page (intercepting route), subtasks, attachments
- [ ] Kanban with accessible DnD
- [ ] Realtime + presence + reconnect
- [ ] List view (grouping, inline edit, bulk, virtualisation)
- [ ] Calendar month view + DnD + unscheduled drawer
- [ ] Comments + mentions + markdown sanitisation
- [ ] Activity feeds
- [ ] Notifications bell + inbox + preferences
- [ ] ⌘K search + filters (URL) + My Tasks + real dashboard
- [ ] Permissions hook + viewer mode
- [ ] ➖ Swimlanes · ➖ Saved views · ➖ Week calendar

**Tests**
- [ ] pgTAP Phase 2 (≥ 45 assertions)
- [ ] Vitest Phase 2 utils
- [ ] Playwright journeys 1–12

**Phase 2 acceptance:** AC1 ⬜ AC2 ⬜ AC3 ⬜ AC4 ⬜ AC5 ⬜ AC6 ⬜ AC7 ⬜ AC8 ⬜ AC9 ⬜ AC10 ⬜ AC11 ⬜ AC12 ⬜ AC13 ⬜ AC14 ⬜

### Phase 3 — Intelligence & Innovation

**Database**
- [ ] M1 `p3_dependencies` (+ cycle trigger, `v_task_effective`)
- [ ] M2 `p3_pulse_workload` (+ snapshot/apply RPCs)
- [ ] M3 `p3_gamification` (+ XP/streak/achievement triggers, leaderboard RPC)
- [ ] M4 `p3_ai` (+ quota RPCs)
- [ ] M5 `p3_daily_jobs` (pruning)

**Algorithms (`src/lib/algorithms`)**
- [ ] consideredTasks / effectivelyBlocked
- [ ] computePulse
- [ ] computeWorkload / recommendReassignments
- [ ] detectRisks / forecastFinish / priorityScore
- [ ] wouldCreateCycle
- [ ] XP / streak / level mirrors
- [ ] burndown / CFD / throughput / cycle time
- [ ] Coverage ≥ 90 %

**Features**
- [ ] Dependencies UI in task sheet + blocked badges
- [ ] Dependency Map (+ critical chain, mobile tree)
- [ ] Pulse card, mini rings, trend, lazy snapshot, cron snapshots
- [ ] Workload page + recommendations apply/dismiss
- [ ] Risks list + milestone forecasts + suggested next
- [ ] Project analytics (MVP charts) + workspace analytics
- [ ] Gamification UI (chip, leaderboard, achievements, toasts)
- [ ] My week insights
- [ ] AI orchestrator + quotas + logging
- [ ] AI breakdown + summary (MVP)
- [ ] ➖ AI plan-project · ➖ AI priorities · ➖ AI risk narrative · ➖ CFD & cycle-time charts

**Tests**
- [ ] Unit (algorithms, AI)
- [ ] pgTAP Phase 3
- [ ] Playwright 1–10 (fallback + mocked AI)

**Phase 3 acceptance:** AC1 ⬜ AC2 ⬜ AC3 ⬜ AC4 ⬜ AC5 ⬜ AC6 ⬜ AC7 ⬜ AC8 ⬜ AC9 ⬜ AC10 ⬜ AC11 ⬜ AC12 ⬜

### Phase 4 — Testing & Deployment

- [ ] Coverage gap analysis + traceability matrix
- [ ] Server Action integration tests
- [ ] pgTAP isolation matrix (all tables × 7 roles)
- [ ] E2E consolidated (`@smoke`, `@full`) + visual snapshots + error paths
- [ ] Security audit (queries, Advisor, definer review, IDOR, XSS, uploads, secrets, headers, ZAP, auth, abuse, npm audit)
- [ ] Performance (Lighthouse CI, bundle split, EXPLAIN, realtime cleanup)
- [ ] Accessibility audit (axe all routes, keyboard, screen reader, contrast, reduced motion, zoom)
- [ ] Responsive audit (6 viewports + real devices)
- [ ] UI polish + loading/error/not-found everywhere + offline banner + manifest/OG
- [ ] Account deletion + data export
- [ ] Production deploy verified + smoke suite against prod
- [ ] Daily workflow verified + health check
- [ ] Pilot usage (≥ 7 days real team usage)
- [ ] README + docs tree + user guide
- [ ] Academic report draft + slides + demo script + viva Q&A
- [ ] Fresh-clone test
- [ ] Evaluation self-assessment (§L)
- [ ] Release v1.0.0

**Phase 4 acceptance:** AC1 ⬜ AC2 ⬜ AC3 ⬜ AC4 ⬜ AC5 ⬜ AC6 ⬜ AC7 ⬜ AC8 ⬜ AC9 ⬜ AC10 ⬜ AC11 ⬜ AC12 ⬜ AC13 ⬜ AC14 ⬜

---

## 5. Feature Status Matrix

| Module (spec §B) | Tier | Phase | DB | Backend | UI | Tests | Status |
|---|---|---|---|---|---|---|---|
| B.1 Authentication | MVP | 1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.2 Onboarding & Profile | MVP | 1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.3 Workspaces | MVP | 1–2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.4 Teams | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.5 Projects | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.6 Milestones | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.7 Tasks | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.8 Assignments | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.9 Kanban | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.10 List view | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.11 Calendar | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.12 Dependencies | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.13 Comments & mentions | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.14 Notifications | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.15 Activity logs | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.16 Search | MVP | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.17 Filters / saved views | MVP / Adv | 2 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.18 Analytics | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.19 Project Pulse | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.20 Dependency Map | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.21 Workload Balance | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.22 AI Assistant | MVP (breakdown, summary) / Adv | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.23 Gamification | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.24 Productivity insights | MVP | 3 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.25 Settings | MVP | 1–4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| B.26 Export | MVP (CSV) / Adv | 2–4 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

## 6. Database Migration Status

| # | Migration (logical name) | File (timestamped) | Phase | Local | Dev project | Production | Notes |
|---|---|---|---|---|---|---|---|
| 1 | p1_extensions_enums | `20261108000100_p1_extensions_enums.sql` | 1 | 🟨 CI | ➖ | ⬜ | PGlite harness ✅ |
| 2 | p1_profiles | `20261108000200_p1_profiles.sql` | 1 | 🟨 CI | ➖ | ⬜ | PGlite harness ✅ |
| 3 | p1_workspaces_core | `20261108000300_p1_workspaces_core.sql` | 1 | 🟨 CI | ➖ | ⬜ | PGlite harness ✅ |
| 4 | p1_rls_helpers | `20261108000400_p1_rls_helpers.sql` | 1 | 🟨 CI | ➖ | ⬜ | PGlite harness ✅ |
| 5 | p1_storage_avatars | `20261108000500_p1_storage_avatars.sql` | 1 | 🟨 CI | ➖ | ⬜ | PGlite harness ✅ |
| 6 | p2_invitations_membership | | 2 | ⬜ | ⬜ | ⬜ | |
| 7 | p2_teams | | 2 | ⬜ | ⬜ | ⬜ | |
| 8 | p2_projects | | 2 | ⬜ | ⬜ | ⬜ | |
| 9 | p2_tasks | | 2 | ⬜ | ⬜ | ⬜ | |
| 10 | p2_collaboration | | 2 | ⬜ | ⬜ | ⬜ | |
| 11 | p2_activity_notifications | | 2 | ⬜ | ⬜ | ⬜ | |
| 12 | p2_search | | 2 | ⬜ | ⬜ | ⬜ | |
| 13 | p2_realtime | | 2 | ⬜ | ⬜ | ⬜ | |
| 14 | p2_daily_jobs_base | | 2 | ⬜ | ⬜ | ⬜ | |
| 15 | p3_dependencies | | 3 | ⬜ | ⬜ | ⬜ | |
| 16 | p3_pulse_workload | | 3 | ⬜ | ⬜ | ⬜ | |
| 17 | p3_gamification | | 3 | ⬜ | ⬜ | ⬜ | |
| 18 | p3_ai | | 3 | ⬜ | ⬜ | ⬜ | |
| 19 | p3_daily_jobs | | 3 | ⬜ | ⬜ | ⬜ | |
| 20 | p4_account_lifecycle | | 4 | ⬜ | ⬜ | ⬜ | `delete_my_account` |

## 7. Files Created / Modified

Append per session. Group by phase.

| Date | Phase | Created | Modified | Purpose |
|---|---|---|---|---|
| 2026-11-08 | 1 | `src/app/**` (marketing, auth, callback, app resolver, onboarding, invite, `w/[workspaceSlug]/**`, settings, dev/design, robots, sitemap, OG image), `src/components/{brand,layout,auth,onboarding,settings,profile,forms,marketing,workspace,dev}/**`, `src/lib/**`, `src/hooks/**`, `src/proxy.ts`, `src/types/database.ts`, `supabase/{config.toml,migrations/*,tests/phase1_rls.test.sql,seed.sql,README.md}`, `tests/unit/**`, `tests/e2e/**`, `playwright.config.ts`, `vitest.config.mts`, `.github/workflows/{ci,gitleaks}.yml`, `.gitleaks.toml`, `.env.example`, `README.md`, `scripts/capture-screenshots.mjs`, `docs/screenshots/phase1/*` | shadcn `dropdown-menu`, `select` (neutral focus colour), `slider` (thumb label, larger hit area); `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, `.gitignore` | Phase 1 foundation |

## 8. Testing Status

| Suite | Tool | Phase | # Tests | Passing | Coverage | Last run | Notes |
|---|---|---|---|---|---|---|---|
| Unit — algorithms | Vitest | 1–3 | 13 (pulse-demo) | 13 | target ≥ 90 % | 2026-11-08 | |
| Unit — lib/utils | Vitest | 1–4 | 85 | 85 | target ≥ 70 % | 2026-11-08 | safe-next, validators, error maps, slug, invite, contrast, format, tz, nav, hotkeys |
| Component | Vitest + RTL | 1–3 | 6 | 6 | | 2026-11-08 | PulseRing, EmptyState, ComingSoon, icons |
| Integration — server actions | Vitest + local Supabase | 2–4 | | | | | |
| Database — RLS/triggers | pgTAP | 1–4 | 30 | 30 in PGlite harness; real run pending CI | every table | 2026-11-08 | |
| E2E — @smoke | Playwright | 1–4 | 32 specs × 2 projects | 52 pass, 12 skipped (need Supabase) locally | | 2026-11-08 | Supabase-dependent specs run in CI |
| E2E — @full | Playwright | 1–4 | | | | | |
| Accessibility | axe + manual | 1–4 | landing, login, signup, forgot | 0 serious/critical (local) | 0 serious | 2026-11-08 | onboarding + dashboard axe in CI |
| Responsive | Playwright viewports | 1–4 | | | | | |
| Performance | Lighthouse CI | 4 | | | ≥ 90 landing | | |
| Security | ZAP, gitleaks, npm audit, manual | 4 | | | 0 high | | |

## 9. Bugs

| ID | Date | Phase | Severity (S1–S4) | Description | Steps to reproduce | Status | Fix commit |
|---|---|---|---|---|---|---|---|
| BUG-001 | 2026-11-08 | 1 | S2 | Handle base truncated to 3 chars (`rpad` also truncates) | New user alice@… got handle `ali_1234` | ✅ Fixed before first commit | phase 1 commit |
| BUG-002 | 2026-11-08 | 1 | S1 | CSP `upgrade-insecure-requests` + HSTS broke CSS/JS on `http://localhost` in WebKit | `next start`, open in WebKit → unstyled, no JS | ✅ Fixed: emitted only when NEXT_PUBLIC_APP_URL is https | phase 1 commit |

## 10. Dependency Versions (record exact installed versions)

| Package / Tool | Version | Date | Notes |
|---|---|---|---|
| Node.js | 24.15.0 (local), lts/* (CI) | 2026-11-08 | |
| next | 16.4.5 | 2026-11-08 | `proxy.ts` replaces middleware |
| react | 19.3.0 | 2026-11-08 | |
| @supabase/supabase-js | 2.119.0 | 2026-11-08 | |
| @supabase/ssr | 0.12.7 | 2026-11-08 | |
| Supabase CLI | 3.0.0 (npm devDependency) | 2026-11-08 | |
| tailwindcss | 4.3.5 | 2026-11-08 | CSS-first config |
| shadcn (CLI) | 4.23.0 (style radix-nova) | 2026-11-08 | also zod 4.6.7, vitest 5.1.0, @playwright/test 1.65.0, TypeScript 5.9.3, ESLint 9.39.5 |
| @dnd-kit/core | | | |
| recharts | | | |
| @xyflow/react | | | |
| Gemini SDK / model (`GEMINI_MODEL`) | | | verify free-tier eligibility |

## 11. Decisions & Deviations from Specification

| Date | Spec section | Decision / deviation | Reason | Approved by |
|---|---|---|---|---|
| 2026-11-08 | P1 Step 3 | `src/middleware.ts` → `src/proxy.ts` (logic in `lib/supabase/middleware.ts`) | Next.js 16 renamed the middleware convention | n/a (framework change) |
| 2026-11-08 | — | `cacheComponents` disabled (scaffold default was on) | Nearly every route reads the session cookie; under Cache Components each read must sit in Suspense or the build fails | Claude Code |
| 2026-11-08 | P1 Step 1.4 | shadcn `form` replaced by `field` + own `FormField` wrapper | `form` is no longer in the shadcn 4.23 registry | n/a |
| 2026-11-08 | P1 Step 2.2 | Tailwind v4 theme in `globals.css` `@theme` (no tailwind.config) | Tailwind 4 CSS-first config | n/a |
| 2026-11-08 | §F.2 | Palette kept exact. Added `*-text` variants (e.g. `--warning-text #8A5800`) for signal colours used as small text, and darkened non-palette glyph tokens (priority-medium, cancelled/none) | Spec warning/info/success fail 4.5:1 as text on white; the spec also requires AA | Claude Code |
| 2026-11-08 | §F.2 | `--accent` = Pulse Coral; shadcn menus' focus colour switched from `accent` to `muted` | Avoid coral menu highlights ("signal over decoration") | Claude Code |
| 2026-11-08 | §D.4 | Column protection via `REVOKE UPDATE` on table + `GRANT UPDATE (cols)` | Column-level REVOKE has no effect while a table-level UPDATE grant exists (Supabase grants it by default) | Claude Code |
| 2026-11-08 | §D.4 | SECURITY DEFINER functions use `search_path = public, extensions, pg_temp` | `citext` lives in `extensions`; without it citext comparisons silently become case-sensitive | Claude Code |
| 2026-11-08 | §B.2 | Added RPC `is_handle_available` (in p1_profiles) | Profiles are only visible to co-members, so clients can't check global handle uniqueness | Claude Code |
| 2026-11-08 | P1 Step 3 | `/app` also protected by the proxy | Resolver needs a session | Claude Code |
| 2026-11-08 | §H.1 | HSTS / `upgrade-insecure-requests` only when the app URL is https | BUG-002 | Claude Code |
| 2026-11-08 | §J.1 | No Docker on the developer machine → pgTAP & Supabase e2e run in GitHub Actions; migrations pre-checked locally with a PGlite harness (scratch tooling, not committed) | Environment constraint | Claude Code |

## 12. Pending Tasks / Blockers

| # | Task | Owner | Blocked by | Due |
|---|---|---|---|---|
| 1 | Create Supabase project `teamsync-prod`, configure Auth URLs, `supabase link` + `supabase db push` | Student | Supabase account login (cannot be done by the agent) | before Phase 4 |
| 2 | Import repo into Vercel, set env vars from `.env.example` | Student | Vercel account login | before Phase 4 |
| 3 | Optional: Google OAuth client → set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` | Student | Google Cloud Console | optional |
| 4 | Lighthouse run on a production build (AC12) | Claude Code | — | Phase 4 |

## 13. Deployment Status

| Item | Status | Evidence (link / output) | Date |
|---|---|---|---|
| Supabase prod project created | ⬜ Not performed — requires the student's Supabase login | | 2026-11-08 |
| Auth URLs + Google OAuth configured | ⬜ | | |
| All migrations pushed to prod (count matches) | ⬜ | | |
| Security Advisor clean | ⬜ | | |
| Vercel project linked, env vars set | ⬜ Not performed — requires the student's Vercel login | | 2026-11-08 |
| Production deploy live | ⬜ | URL + commit SHA | |
| Smoke suite green against prod | ⬜ | | |
| `/api/health` OK | ⬜ | | |
| Daily workflow succeeded | ⬜ | Actions run link | |
| Free-tier usage recorded | ⬜ | DB MB / egress GB / MAU / AI requests | |
| Release v1.0.0 tagged | ⬜ | | |

> ⚠️ Mark deployment items ✅ only with evidence. Never record an unverified URL as live.

## 14. Free-Tier Usage Log

| Date | Supabase DB size | Storage | Egress (month) | MAU | Realtime peak | Vercel bandwidth | Gemini requests today | Action needed |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## 15. Handover Notes

### After Phase 1
**Phase 2 can rely on:** typed server/browser Supabase clients; `requireProfile`, `getMyWorkspaces`, `getWorkspaceBySlug` (`src/lib/data/session.ts`); `ActionResult` + `mapPgError`; RLS helpers `is_workspace_member / workspace_role_of / is_workspace_admin / shares_workspace_with`; owner-protection trigger honouring `teamsync.allow_owner_change` for the transfer RPC; app shell with `useWorkspace()`, `useShellUi()` (palette/dialogs), extensible `PaletteSource` for async search, `SyncLine.trigger()`; `ComingSoon`/`EmptyState`; all enums already exist.
**Known limitations:** deployment not performed (needs student accounts); Lighthouse not yet run; Google OAuth untested (no client configured).

### After Phase 2
_Extension points for Phase 3 (effective-blocked hook, Pulse slot, analytics routes, gamification triggers)._

### After Phase 3
_Performance hotspots; deferred Advanced items._

### After Phase 4
_Final state; remaining student TODOs in report._
