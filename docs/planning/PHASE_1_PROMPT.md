# PHASE 1 PROMPT — Foundation, Design System, Auth & App Shell

> Paste this file into Claude Code together with `PROJECT_SPECIFICATION.md`.
> **`PROJECT_SPECIFICATION.md` is the authoritative source of truth.** Section references like "§F.2" point into it. If anything here conflicts with it, follow the specification and log the conflict in `IMPLEMENTATION_TRACKER.md` → *Decisions & Deviations*.

---

## 0. Your Role & Ground Rules

You are the lead engineer implementing **Phase 1 of TeamSync**. Work incrementally, commit after each numbered step, and keep `IMPLEMENTATION_TRACKER.md` updated.

**Do:**
- Read §A, §C, §D.1–D.5, §F, §H and §J of the specification before writing code.
- Use only free/open-source dependencies (see `FREE_TIER_SERVICES.md`).
- Check the current official docs for Next.js, `@supabase/ssr`, shadcn/ui and Tailwind before setup — APIs change. Record exact versions installed in the tracker.
- Commit with the student's own Git identity (`git config user.name` / `user.email` already set by the student — do not change them, do not add AI co-author trailers).

**Do NOT:**
- Build workspaces management beyond what onboarding needs, projects, tasks, boards or analytics (Phases 2–3).
- Put any secret (service-role key, Gemini key) in client code or in `NEXT_PUBLIC_*` variables.
- Render fake metrics, fake charts or placeholder numbers on any authenticated page.
- Create non-functional buttons. If a nav item's feature arrives in a later phase, render a polished "Coming in Phase N" empty state page — not a dead link.
- Disable RLS "temporarily".

---

## 1. Objectives

1. A production-grade Next.js + TypeScript + Tailwind + shadcn/ui codebase with the folder structure in §C.3.
2. The **"Calm Signal" design system** (§F.1–F.8) implemented as tokens, fonts, primitives and branded components, in light and dark mode.
3. Supabase connected (local and cloud) with the Phase 1 schema, RLS, triggers and storage bucket.
4. Complete authentication (email/password + Google OAuth, reset password, protected routes).
5. A polished **landing page**, **auth screens**, **onboarding wizard**, **app shell** (sidebar, topbar, mobile bottom nav, command palette skeleton), **dashboard shell**, **profile & preferences settings**.
6. Security baseline: headers, env handling, server-only modules, CI with lint/typecheck/tests.

## 2. Prerequisites

- Node.js LTS, Git, GitHub account, Supabase account (free), Vercel account (Hobby), Supabase CLI. Docker Desktop recommended for local Supabase; if unavailable, create Supabase free project `teamsync-dev` and use it as the dev database (record the choice in the tracker).
- Google Cloud OAuth client (free) for Google sign-in — optional for local; if not configured, hide the Google button behind `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`.

## 3. Dependencies on Previous Phases

None. This phase creates the foundation for all others.

---

## 4. Step-by-Step Implementation

### Step 1 — Project scaffold

1. Create the app in the repo root (the repo root is the application; planning docs move to `/docs/planning/`):
   - `create-next-app` with TypeScript, ESLint, Tailwind, App Router, `src/` directory, import alias `@/*`.
2. Install runtime deps: `@supabase/supabase-js @supabase/ssr @tanstack/react-query zod react-hook-form @hookform/resolvers framer-motion lucide-react sonner date-fns date-fns-tz clsx tailwind-merge class-variance-authority next-themes cmdk vaul server-only`.
3. Install dev deps: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @axe-core/playwright prettier prettier-plugin-tailwindcss supabase`.
4. Initialise shadcn/ui and add: `button input label textarea card dialog sheet drawer dropdown-menu popover tooltip avatar badge separator skeleton tabs select checkbox switch radio-group form command scroll-area sonner alert progress toggle toggle-group`.
5. Create the folder skeleton exactly as §C.3 (empty `index.ts` files are fine where needed).
6. Scripts in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (vitest run), `test:watch`, `test:e2e` (playwright), `format`, `db:start`, `db:reset`, `db:test` (`supabase test db`), `gen:types` (`supabase gen types typescript --local > src/types/database.ts`).
7. `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
8. `.gitignore` includes `.env*` except `.env.example`; add `.env.example` with every variable from §J.7 (blank values, comments).
9. Move the planning markdown files into `docs/planning/` and add a short root `README.md` stub (expanded in Phase 4).

**Verify:** `npm run lint && npm run typecheck && npm run build` pass.

### Step 2 — Design system (§F.2–F.8)

1. **Fonts** via `next/font/google`: Bricolage Grotesque (display), Inter (body, variable), JetBrains Mono (mono). Expose as CSS variables `--font-display`, `--font-sans`, `--font-mono`; configure Tailwind `fontFamily`.
2. **Tokens** in `src/app/globals.css` as CSS variables for `:root` (light) and `.dark` (dark) using **exactly** the palette in §F.2, mapped to shadcn token names (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, …) plus custom tokens `--surface-2`, `--ai`, `--success`, `--warning`, `--danger`, `--info`, status and priority tokens. Extend Tailwind theme to use them (`bg-surface-2`, `text-ai`, etc.).
3. Radius, spacing, elevation, container widths per §F.4; breakpoints per §F.5.
4. `next-themes` provider with `attribute="class"`, system default, no flash (suppressHydrationWarning on `<html>`).
5. Motion: `src/lib/motion.ts` exporting durations/easings from §F.6 and a `useReducedMotionPreference()` hook combining `prefers-reduced-motion` with the profile setting (profile setting wired in Step 9). Provide `MotionSafe` wrapper.
6. **Brand components** in `src/components/brand/`:
   - `Logo` (SVG wordmark + mark: two interlocking arcs forming an "S"-like sync loop; uses `currentColor` + `--accent`).
   - `PulseRing` (props: `score: number | null`, `factors?: {weight:number; subScore:number; label:string}[]`, `size`, `animated`). Segmented arcs per factor (segment length ∝ weight, filled portion ∝ subScore), centre score, band colour from §F.2, heartbeat pulse animation (off under reduced motion), `null` renders a dashed ring with "—" and accessible label "Not enough data". In Phase 1 it is used only on the landing page interactive demo.
   - `SyncLine` (2 px animated gradient line for the app shell top; exposes `trigger()` via context to animate on realtime events later).
   - `GrainOverlay` (CSS noise via inline SVG data URI, 2 % opacity).
   - `StatusIcon`, `PriorityIcon` (icons + labels for every status/priority, colour + shape — §F.2).
   - `EmptyState` (icon/illustration, title, description, primary + secondary action), `ComingSoon` (variant of EmptyState naming the phase).
7. A **design system page** at `/dev/design` (only rendered when `process.env.NODE_ENV !== 'production'`) showing typography, colours (with contrast ratios computed at runtime and flagged if < 4.5), buttons, inputs, cards, badges, PulseRing variants, empty states, in both themes. Use it to verify contrast.

**Verify:** Visit `/dev/design` in light and dark: all text pairs ≥ 4.5:1 (UI glyphs ≥ 3:1). Screenshot both themes into `docs/screenshots/phase1/`.

### Step 3 — Supabase clients & middleware

1. `src/lib/supabase/client.ts` — browser client (`createBrowserClient`) typed with `Database`.
2. `src/lib/supabase/server.ts` — server client for RSC/Server Actions/Route Handlers using `cookies()` (follow current `@supabase/ssr` docs).
3. `src/lib/supabase/middleware.ts` + `src/middleware.ts` — refresh session; protect `/w/:path*`, `/onboarding`, `/settings/:path*`, `/invite/:token/accept`; redirect anonymous users to `/login?next=<path>`; redirect authenticated users away from `/login` and `/signup` to `/` app entry (`/app` resolver route, see Step 7). Exclude static assets in `matcher`.
4. `src/lib/supabase/admin.ts` — service-role client, file starts with `import 'server-only'`; **not imported anywhere in Phase 1** except a comment noting it is reserved for `/api/cron/*`.
5. `src/lib/env.ts` — zod-validated env parsing; separate `clientEnv` (only `NEXT_PUBLIC_*`) and `serverEnv` (`import 'server-only'`). App fails fast with a clear message if required vars are missing.
6. TanStack Query provider in `src/app/providers.tsx` (with theme provider and `Toaster`).

### Step 4 — Phase 1 database migrations

Create with `supabase migration new` (timestamps automatic). Logical names and required content:

**`p1_extensions_enums`**
- `create extension if not exists citext; pgcrypto` (if not already enabled).
- Enums (all of them now, to avoid enum alteration churn later): `workspace_role ('owner','admin','member','guest')`, `project_role ('lead','contributor','viewer')`, `project_status ('planning','active','on_hold','completed','archived')`, `project_visibility ('workspace','private')`, `task_status ('backlog','todo','in_progress','in_review','done','cancelled')`, `task_priority ('urgent','high','medium','low','none')`, `milestone_status ('open','completed')`, `invite_status ('active','revoked','exhausted','expired')`, `notification_type` (all values in §B.14).
- Generic `set_updated_at()` trigger function.

**`p1_profiles`**
- `profiles` table exactly per §D.2 #1 (including `last_workspace_id` — add the FK in the workspaces migration after `workspaces` exists).
- `handle_new_user()` `SECURITY DEFINER` trigger on `auth.users` AFTER INSERT: `full_name` from `raw_user_meta_data->>'full_name'` (or `name`, fallback email prefix), `handle` = sanitised email prefix (lowercase, `[a-z0-9_]`, 3–15 chars, padded) + `_` + 4 random digits, retry on unique conflict (loop max 5), `avatar_url` from OAuth metadata if present.
- Trigger validating `timezone` exists in `pg_timezone_names`.
- RLS: enable; SELECT own row OR shares a workspace (use `exists` on `workspace_members` self-join — implemented via helper in the RLS migration); UPDATE own row only (`WITH CHECK id = auth.uid()`); no INSERT/DELETE policies. `REVOKE UPDATE (id, created_at, onboarded_at) ON profiles FROM authenticated`.

**`p1_workspaces_core`**
- `workspaces` and `workspace_members` per §D.2 #2–3 (owner partial unique index, owner-protection trigger).
- Add FK `profiles.last_workspace_id → workspaces(id) ON DELETE SET NULL`.
- RPC `create_workspace(p_name text, p_slug text) returns workspaces` — `SECURITY DEFINER`, `SET search_path = public, pg_temp`; requires `auth.uid()` not null; validates slug regex; inserts workspace (`owner_id = auth.uid()`) + member row role `owner`; updates `profiles.last_workspace_id`; returns row. Raise `CONFLICT:` prefixed message on slug clash.
- RPC `is_slug_available(p_slug text) returns boolean` (authenticated only).
- RPC `complete_onboarding(p_full_name text, p_job_title text, p_timezone text, p_avatar_url text) returns profiles` — sets fields and `onboarded_at = now()` for `auth.uid()`.
- RPC `set_last_workspace(p_workspace uuid)` — only if member.

**`p1_rls_helpers`**
- Helper functions from §D.4 that only depend on Phase 1 tables: `is_workspace_member(uuid)`, `workspace_role_of(uuid)`, `is_workspace_admin(uuid)` — all `SECURITY DEFINER STABLE SET search_path = public, pg_temp`, `REVOKE EXECUTE … FROM public, anon; GRANT EXECUTE … TO authenticated`.
- Policies:
  - `workspaces`: SELECT `is_workspace_member(id)`; UPDATE `is_workspace_admin(id)`; no direct INSERT/DELETE.
  - `workspace_members`: SELECT `is_workspace_member(workspace_id)`; no direct INSERT/UPDATE/DELETE in Phase 1 (RPCs only).
  - `profiles` SELECT policy using a helper `shares_workspace_with(uuid)`.
- `REVOKE UPDATE (owner_id, id, created_at) ON workspaces FROM authenticated`.

**`p1_storage_avatars`**
- Insert bucket `avatars` (public = true, `file_size_limit` 2 MB, `allowed_mime_types` `{image/png,image/jpeg,image/webp}`).
- Storage policies: anyone can read `avatars`; authenticated users can insert/update/delete objects only where `(storage.foldername(name))[1] = auth.uid()::text`.

**Seed:** `supabase/seed.sql` for **local only** — creates nothing that would appear as analytics; may create two confirmed test users for RLS tests (document credentials in `supabase/README.md`, local only).

**Verify:** `supabase db reset` succeeds; `npm run gen:types` regenerates `src/types/database.ts`.

### Step 5 — Database tests (pgTAP)

Create `supabase/tests/phase1_rls.test.sql` using pgTAP and helper functions that set `request.jwt.claims` / `role authenticated` to impersonate users. Tests (minimum 12):
1. RLS enabled on `profiles`, `workspaces`, `workspace_members`.
2. New auth user ⇒ profile created with valid unique handle.
3. User A can update own profile; cannot update B's.
4. User A creates workspace via RPC ⇒ is owner member.
5. User B (not member) selects A's workspace ⇒ 0 rows.
6. User B cannot see A's `workspace_members` rows.
7. B cannot see A's profile unless they share a workspace.
8. Direct INSERT into `workspaces` by authenticated user is denied.
9. Duplicate slug via RPC raises `CONFLICT`.
10. Anonymous role cannot execute helper functions.
11. Owner row cannot be deleted / second owner cannot be inserted.
12. Storage: object path not starting with own uid is rejected (if testable locally; otherwise document manual test).

**Verify:** `npm run db:test` green.

### Step 6 — Authentication UI (§B.1, §F.10 Auth)

Routes in `src/app/(auth)/`: `login`, `signup`, `forgot-password`, `reset-password`; route handler `src/app/auth/callback/route.ts`; Server Actions in `src/app/(auth)/actions.ts`.

- Layout: split screen — left brand panel (gradient from `--primary` to `--accent` at low saturation, `GrainOverlay`, Logo, rotating 3 product statements with fade, hidden < 1024 px), right form card centred, max-width 400 px.
- Forms with react-hook-form + zod (`src/lib/validation/auth.ts`): password rule min 8 with ≥ 1 letter and ≥ 1 number; full name 1–80.
- Sign up: `supabase.auth.signUp` with `emailRedirectTo = ${APP_URL}/auth/callback?next=/onboarding` and `data.full_name`. Show "Check your inbox" state if confirmation is required.
- Login: generic error "Invalid email or password". `next` param honoured but **only relative paths** (open-redirect protection).
- Google: `signInWithOAuth({ provider: 'google', options: { redirectTo } })`, behind feature flag.
- Forgot/reset password flows with success states.
- Map Supabase error codes to friendly messages (`src/lib/auth/errors.ts`), including email rate limit.
- Show/hide password toggle, caps-lock hint, loading state on submit, autofocus, correct `autocomplete` attributes.
- Logout action in user menu; on logout redirect to `/`.

**Verify:** sign up → callback → onboarding; logout; login with `next`; reset password end-to-end (locally via Inbucket/Mailpit from Supabase CLI).

### Step 7 — Post-login resolver & Onboarding (§B.2)

1. `src/app/(app)/app/page.tsx` — server resolver: if `!profile.onboarded_at` or no workspace membership → `/onboarding`; else redirect to `/w/{slug}` of `last_workspace_id` (if still member) or first workspace.
2. `/onboarding` wizard (client component, 3 steps, progress dots, back/next, animated step transitions):
   - **Step 1 Profile:** full name (prefilled), job title, timezone (auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`, searchable select of IANA zones), avatar upload (crop to square client-side using canvas, upload to `avatars/{uid}/avatar-{timestamp}.webp`, max 2 MB).
   - **Step 2 Workspace:** name → auto slug (debounced availability check via `is_slug_available`, green tick / red message with suggestion), or "I have an invite link" (text field accepting a URL or token; in Phase 1 shows a note that invites activate in Phase 2 — keep the field but route to `/invite/[token]` which renders `ComingSoon`).
   - **Step 3 Finish:** summary card; "Go to dashboard". (Project creation from templates is added in Phase 2 — show a disabled-looking but explained "Templates arrive with Projects" note; no dead buttons.)
   - Submit calls a Server Action that runs `complete_onboarding` then `create_workspace` and redirects to `/w/{slug}`.
3. Live preview card on the right (≥ 1024 px) showing the workspace name, slug URL and avatar as the user types.

### Step 8 — App shell & navigation (§F.4, §F.7, §F.9)

`src/app/(app)/w/[workspaceSlug]/layout.tsx` (server): loads workspace by slug under RLS (404 via `notFound()` if not member), memberships for switcher, profile; calls `set_last_workspace`.

- **Sidebar** (264 px, collapsible to 64 px rail, state persisted in `localStorage` with try/catch): workspace switcher (dropdown listing user's workspaces + "Create workspace" dialog using `create_workspace`), primary nav: Home, My Tasks, Inbox, Projects (section with "+" — opens ComingSoon dialog naming Phase 2), Teams, Members, Analytics, Leaderboard; bottom: Settings, theme toggle, user menu (profile, preferences, keyboard shortcuts, sign out).
- **Topbar** (56 px): breadcrumbs, search trigger (shows `⌘K` hint), notification bell (renders 0 state; wired in Phase 2), "New" button (opens ComingSoon in Phase 1), presence area placeholder hidden in Phase 1.
- **SyncLine** at top of shell.
- **Mobile (< 768 px):** sidebar hidden; bottom tab bar (Home, My Tasks, Search, Inbox, Menu) with 44 px targets, safe-area insets; Menu opens a `Drawer` with the full nav.
- **Command palette** (`cmdk` in a Dialog, `⌘K`/`Ctrl+K`, `/`): Phase 1 commands = navigation to every route, toggle theme, open settings, sign out. Architecture must allow adding async result groups in Phase 2.
- **Keyboard shortcuts dialog** (`?`) listing implemented shortcuts only.
- Routes for later-phase pages (`my-tasks`, `inbox`, `projects`, `teams`, `members`, `analytics`, `leaderboard`, `settings`) render `ComingSoon` with the phase number and a one-line description from §B. Members page may already list workspace members (read-only) since data exists — preferred.
- Skip-to-content link, landmarks (`nav`, `main`, `header`), `aria-current` on active nav.
- `loading.tsx`, `error.tsx`, `not-found.tsx` for the `(app)` and `w/[workspaceSlug]` segments, styled with EmptyState.

### Step 9 — Dashboard shell & Profile/Preferences settings

1. **Dashboard** `/w/[ws]`: greeting with name and local date ("Good morning, Murari · Sunday, 8 November"), workspace summary built **only from real data available in Phase 1** (member count, your role, created date), and an onboarding checklist card with real completion state: ✅ Create workspace, ☐ Invite teammates (Phase 2), ☐ Create first project (Phase 2), ☐ Complete a task (Phase 2). The other dashboard widgets from §F.10 appear as EmptyState cards explaining what they'll show — no fake charts.
2. **Settings** `/settings/profile` and `/settings/preferences` (layout with left sub-nav; on mobile a select):
   - Profile: full name, handle (live availability check, regex `^[a-z0-9_]{3,20}$`), job title, avatar (reuse uploader), timezone.
   - Preferences: theme (system/light/dark — persisted to profile and applied via next-themes), reduced motion, week start, weekend streak protection (explain it applies in Phase 3), show on leaderboard.
   - `/settings/security`: change password (requires current session), sign out of other sessions (`signOut({ scope: 'others' })`). Account deletion is deferred to Phase 4 — show explained note.
   - `/settings/notifications`: ComingSoon (Phase 2).
   - Every form: Server Action + zod, optimistic toast "Saved", field errors, disabled save until dirty.

### Step 10 — Landing page (§F.10 Landing)

`src/app/(marketing)/page.tsx` (server component, static):
- Sticky translucent nav (blur, border on scroll): Logo, links (Features, How it works, Pulse, FAQ), theme toggle, "Log in", "Get started".
- **Hero:** display headline (e.g., "Projects that tell you how they're doing."), sub-copy, CTAs ("Start free" → `/signup`, "See how Pulse works" → anchor), grain, and a **decorative product composition** built with real components (board columns with sample card *titles*, a PulseRing) inside a tilted browser frame, `aria-hidden="true"` and captioned "Illustration". No numbers presented as real user metrics.
- **How it works:** 3 steps with icons.
- **Feature bento** (6 tiles: Project Pulse, Workload Balance, Dependency Map, Realtime boards, AI Assistant with fallback, Analytics) with subtle hover lift; reduced-motion safe.
- **"Try the Pulse formula" interactive section:** sliders for completion %, timeline elapsed %, overdue share, due-soon-not-started share, blocked share, workload imbalance (0–1) → computes score with the §G.1 weights client-side via a small pure function in `src/lib/algorithms/pulse-demo.ts` (unit tested) and renders the PulseRing + factor bars + top reason. Clearly labelled "Interactive formula demo".
- **FAQ** accordion (free? data isolation? works without AI? mobile?).
- Footer: Logo, tagline, links (GitHub repo, docs), "Built for academic purposes" note.
- SEO: metadata, Open Graph image (static PNG generated with `next/og` at build), `robots.txt`, `sitemap.xml` for public routes only.
- Lighthouse target ≥ 90 for performance, accessibility, best practices, SEO.

### Step 11 — Security baseline

1. `next.config` security headers (§H.1): CSP allowing `self`, Supabase URL (https + wss), data/blob images for avatars preview, `frame-ancestors 'none'`; `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Test that the app still works (fonts are self-hosted by next/font).
2. `import 'server-only'` in all server-secret modules; add an ESLint rule (`no-restricted-imports`) forbidding `@/lib/supabase/admin` from any file under `src/components` or files with `'use client'`.
3. Open-redirect guard utility `safeNextPath(next)` with unit tests.
4. Add `gitleaks` GitHub Action.

### Step 12 — Testing & CI

1. **Vitest** config (jsdom, setup file with jest-dom). Unit tests: `pulse-demo.ts` (score bounds 0–100, weights sum, monotonicity — increasing overdue never increases score), `safeNextPath`, slug/handle validators, auth error mapper, `cn` util. Component tests: `PulseRing` renders null state & accessible label; `EmptyState`.
2. **Playwright** config with projects: Desktop Chrome, Mobile Safari (WebKit iPhone emulation). E2E specs:
   - `landing.spec.ts`: renders, CTA navigates to signup, Pulse demo slider changes score, axe has 0 serious/critical violations.
   - `auth-onboarding.spec.ts`: sign up (local Supabase with email confirmation disabled in `supabase/config.toml` for local), complete onboarding, land on dashboard, logout, login again → returns to same workspace.
   - `responsive.spec.ts`: at 360×740 no horizontal overflow on `/`, `/login`, `/w/[ws]`; bottom nav visible on mobile, sidebar on desktop.
   - `protected-routes.spec.ts`: anonymous access to `/w/x` redirects to login with `next`.
3. **GitHub Actions** `.github/workflows/ci.yml`: Node LTS, `npm ci`, lint, typecheck, `npm test`, build (with dummy public env vars), and a job that runs `supabase start` + `supabase test db` (Docker is available on `ubuntu-latest` runners).

### Step 13 — First deployment (preview)

1. Create Supabase project `teamsync-prod` (region Mumbai if available); configure Auth URLs (§J.3); `supabase link` + `supabase db push`.
2. Import repo into Vercel; set env vars; deploy. Confirm landing, signup, onboarding work on the deployed URL.
3. Record the URL and date in the tracker. **If deployment was not actually performed (e.g., missing credentials), say so in the tracker — never claim it.**

---

## 5. Database Changes Summary (Phase 1)

| Migration | Objects |
|---|---|
| `p1_extensions_enums` | citext, pgcrypto, all enums, `set_updated_at()` |
| `p1_profiles` | `profiles`, `handle_new_user` trigger, tz validation trigger, RLS |
| `p1_workspaces_core` | `workspaces`, `workspace_members`, owner protections, RPCs `create_workspace`, `is_slug_available`, `complete_onboarding`, `set_last_workspace` |
| `p1_rls_helpers` | `is_workspace_member`, `workspace_role_of`, `is_workspace_admin`, `shares_workspace_with`, policies, column revokes |
| `p1_storage_avatars` | bucket `avatars` + policies |

## 6. Deliverables

- Running app locally and (if credentials available) on Vercel.
- Design system with `/dev/design` page and screenshots (light/dark, desktop/mobile) in `docs/screenshots/phase1/`.
- Landing, auth (4 screens + callback), onboarding, app shell, dashboard shell, settings (profile, preferences, security).
- 5 migrations, regenerated types, pgTAP suite, Vitest + Playwright suites, CI workflow.
- Updated `IMPLEMENTATION_TRACKER.md` (Phase 1 section fully filled: files created, migrations, tests, versions, deviations).

## 7. Acceptance Criteria (all must pass)

| # | Criterion | How to verify |
|---|---|---|
| AC1 | `npm run lint`, `typecheck`, `test`, `build` all pass with 0 errors | CI green |
| AC2 | `supabase db reset` + `npm run db:test` green (≥ 12 tests) | terminal output saved to tracker |
| AC3 | RLS enabled on every `public` table | audit query §H.3 returns 0 rows |
| AC4 | New user can sign up, complete onboarding, reach `/w/{slug}` | Playwright `auth-onboarding` |
| AC5 | Session persists across reload; logout works; protected routes redirect with safe `next` | Playwright |
| AC6 | User B cannot read user A's workspace or profile (no shared workspace) | pgTAP |
| AC7 | Light and dark themes both correct; no flash of wrong theme; contrast ≥ AA on design page | manual + screenshots |
| AC8 | No horizontal scroll at 360 px on landing, auth, onboarding, dashboard, settings | Playwright responsive |
| AC9 | 0 serious/critical axe violations on landing, login, onboarding, dashboard | Playwright + axe |
| AC10 | Service-role key absent from client bundle | `grep -r "service_role" .next/static` returns nothing; ESLint rule in place |
| AC11 | No dead buttons; later-phase items show ComingSoon with phase number | manual click-through checklist in tracker |
| AC12 | Landing Lighthouse ≥ 90 (perf, a11y, best practices, SEO) on production build | Lighthouse report saved |
| AC13 | Every authenticated page shows only real data or explained empty states | manual review |

## 8. Completion Verification (run and report)

Before declaring Phase 1 complete, run and paste summarised results into the tracker:

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run db:reset && npm run db:test
npm run test:e2e
grep -r "service_role" .next/static || echo "OK: no service role in client bundle"
```

Then update `IMPLEMENTATION_TRACKER.md`: mark Phase 1 tasks, list files created/modified, migrations applied (local / prod), test counts, bugs found, and the deployment status (with URL only if actually deployed). Finish with a short handover note: what Phase 2 can rely on, known limitations.
