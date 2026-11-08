# PHASE 4 PROMPT — Testing, Hardening, Polish, Deployment & Documentation

> Paste this file into Claude Code with `PROJECT_SPECIFICATION.md` and the current `IMPLEMENTATION_TRACKER.md`.
> **`PROJECT_SPECIFICATION.md` is authoritative** (§H Security, §I Testing, §J Deployment, §K Academic Documentation, §L Evaluation).

---

## 0. Your Role & Ground Rules

You are the release engineer and QA lead taking TeamSync from "feature complete" to **evaluation-ready**: comprehensive tests, security audit, performance, accessibility and responsive audits, UI polish, robust error handling, production deployment, and complete documentation including the academic report and presentation material.

**Rules:**
- **Truthfulness:** never claim a test passed, an audit was clean, or a deployment succeeded unless you actually ran it and observed the result. Paste command output summaries into the tracker. If something could not be done (missing credentials, no Docker), state it plainly and give the exact steps the student must run.
- Fix root causes; don't silence tests or lint rules. Any rule disabled must be justified inline and listed in the tracker.
- No new features beyond the MVP list, except Advanced-tier items explicitly deferred in earlier handover notes **and** only after every acceptance criterion below is green.
- Do not seed production with fabricated activity. A demo workspace must be created through the app by real accounts (see Step 9).

## 1. Objectives

1. Complete the test pyramid (§I) with reports.
2. Security audit and fixes (§H), including RLS audit, headers, secrets, uploads, AI abuse.
3. Performance optimisation to targets in §I.
4. Accessibility (WCAG 2.2 AA) and responsive audits with fixes.
5. UI polish pass and consistent error handling.
6. Account deletion & personal data export (deferred from Phase 1).
7. Production deployment with CI/CD, monitoring of free-tier quotas, keep-alive.
8. README, docs, academic report material, presentation, demo script.
9. Final acceptance testing against §L.

## 2. Prerequisites

Phases 1–3 acceptance criteria green (check tracker). Production Supabase project and Vercel project exist (or credentials available to create them).

## 3. Dependencies

Everything from Phases 1–3. Handover notes in the tracker list known hotspots and deferred items — read them first.

---

## 4. Step-by-Step

### Step 1 — Test gap analysis
1. Generate coverage (`npm test -- --coverage`); list files under 70 % in `lib/` and all untested Server Actions.
2. Build a **traceability matrix** `docs/testing/traceability.md`: every functional requirement / acceptance criterion in §B → test IDs (unit/pgTAP/E2E) → status. Fill gaps until every MVP requirement has ≥ 1 automated test.

### Step 2 — Complete automated tests
- **Unit/integration:** raise `lib/` coverage ≥ 70 % (algorithms ≥ 90 %). Integration tests for every Server Action in §E.1 against local Supabase: success, validation error, forbidden, not found.
- **pgTAP:** an **isolation matrix** test that, for every table in `public`, impersonates (a) outsider, (b) workspace guest, (c) viewer, (d) contributor, (e) lead, (f) admin, (g) owner and asserts SELECT/INSERT/UPDATE/DELETE outcomes match §D.4. Generate the table list dynamically and fail if a new table lacks expectations.
- **E2E (Playwright):** the 10 critical journeys from §I plus regression specs from Phases 1–3 consolidated into `tests/e2e/` with tags `@smoke` (fast, run on every PR) and `@full`. Add visual regression snapshots (`toHaveScreenshot`) for landing, dashboard, board, analytics in light/dark at desktop and mobile (thresholds tolerant to fonts).
- **Error-path tests:** network failure during drag (route intercept) → rollback + toast; Supabase realtime disconnect → "Reconnecting" pill then recovery; AI 500 → fallback.

### Step 3 — Security audit (record findings in `docs/security/audit.md`: ID, severity, description, fix, verification)
1. Run §H.3 audit queries → 0 rows.
2. Supabase **Security Advisor** and **Performance Advisor** (dashboard) → resolve all errors/warnings or document accepted ones.
3. Review every `SECURITY DEFINER` function: explicit permission check first, fixed `search_path`, `REVOKE … FROM public, anon`. List them in the audit doc.
4. **IDOR tests:** from a logged-in browser context, use supabase-js directly (page.evaluate) to read/update another workspace's task, comment, notification, attachment path, XP rows → all denied.
5. **XSS:** inject `<img src=x onerror=alert(1)>`, `javascript:` links and markdown tricks into task title, description, comment, workspace name, handle → rendered inert everywhere (board, list, notifications, search results, CSV, OG metadata).
6. **Uploads:** wrong MIME (rename .html → .png), oversized file, SVG, path traversal names → rejected; signed URL expiry respected.
7. **Secrets:** `grep -r "service_role\|GEMINI_API_KEY\|CRON_SECRET" .next/static` → none; gitleaks clean on full history; `.env.example` has no values.
8. **Headers:** verify CSP, nosniff, referrer, frame-ancestors on production via `curl -I`; run OWASP ZAP baseline (Docker `zaproxy/zap-stable zap-baseline.py`) against the preview URL; fix highs/mediums.
9. **Auth:** open-redirect attempts via `next=` (absolute URLs, `//evil.com`) → blocked; password policy; email confirmation enabled in production; OAuth redirect allowlist exact.
10. **Abuse/rate limits:** AI quota exhaustion; comment flood (>30/min) rejected; CSV export throttle; cron endpoint 401 without secret, constant-time compare.
11. `npm audit --omit=dev` → no high/critical; Dependabot enabled.

### Step 4 — Performance
Targets (§I): landing Lighthouse ≥ 90 in all categories; dashboard perf ≥ 80; LCP < 2.5 s, CLS < 0.1, INP < 200 ms (lab); board with 300 tasks drags without long tasks > 200 ms.
1. Lighthouse CI (`@lhci/cli`) in GitHub Actions against the preview URL for `/`, `/login`, and an authenticated dashboard (use a CI test account and storage state).
2. Bundle analysis (`@next/bundle-analyzer`): code-split heavy libs (`@xyflow/react`, `recharts`, markdown) via `next/dynamic` with skeletons; ensure the landing page ships no app-only JS.
3. Database: `EXPLAIN ANALYZE` for board load, list with filters, search, analytics RPCs, RLS helper functions on 1 000 tasks; add/adjust indexes; ensure helper functions are `STABLE` and wrapped as `(select auth.uid())` in policies where recommended by Supabase docs to avoid per-row re-evaluation.
4. Query efficiency: no N+1 in loaders (batch with `in()` or views); TanStack Query `staleTime` tuned; prefetch project data on hover in sidebar.
5. Images: `next/image` for avatars with sizes; fonts already self-hosted.
6. Realtime: confirm channel cleanup (no duplicate subscriptions after navigation — check `supabase.getChannels().length`).
7. Record before/after numbers in `docs/testing/performance.md`.

### Step 5 — Accessibility audit (WCAG 2.2 AA)
1. axe on every route (light & dark) → 0 serious/critical; document moderate ones.
2. Manual keyboard pass of all journeys (no traps, logical order, visible focus, `Esc` closes layers, focus returns to trigger).
3. Screen reader smoke test (NVDA on Windows or VoiceOver on macOS/iOS): landing, login, board DnD announcements, task sheet, notifications, Pulse card, charts "View as table".
4. Contrast verification for all tokens in both themes (design page tool) and for chart colours.
5. Reduced motion: OS setting and profile toggle disable non-essential animations (Pulse heartbeat, confetti, card float, SyncLine sweep).
6. Zoom 200 % and text spacing override do not break layouts.
7. Write `docs/testing/accessibility.md` with checklist results.

### Step 6 — Responsive audit
Viewports: 360×740, 390×844, 768×1024, 1024×768, 1280×800, 1536×864, plus one real Android phone and one laptop. For every route: no horizontal page overflow, touch targets ≥ 44 px on mobile, bottom nav and drawers work, dialogs become bottom sheets, tables become cards, charts readable. Automated overflow check in Playwright for all routes; record device screenshots in `docs/screenshots/final/`.

### Step 7 — UI polish & error handling
1. Consistency sweep: spacing scale, radius, typography roles, icon sizes (16/20), button hierarchy (one primary per view), copy tone (sentence case, concise, friendly), date formats, empty-state illustrations consistent.
2. Every route segment has `loading.tsx` (layout-matched skeleton), `error.tsx` (friendly message, retry, error digest shown small for support), `not-found.tsx`.
3. Global `app/global-error.tsx`. All Server Action errors surface as toasts or inline field errors through `mapPgError`; no raw Postgres or stack traces reach users.
4. Offline/network banner (navigator.onLine + failed fetch detection).
5. Micro-interactions reviewed: hover/press states, focus rings, optimistic states, success confirmations, undo toasts.
6. Final dark-mode review of every screen (charts, React Flow, markdown, code blocks).
7. Favicon/app icons, `manifest.webmanifest` (name, theme colours), OG image, page `<title>` per route ("Board · Capstone · TeamSync").

### Step 8 — Account lifecycle
- `/settings/security` **Delete account**: RPC `delete_my_account()` (SECURITY DEFINER) — refuses if user owns any workspace with other members (must transfer first); deletes sole-member workspaces; anonymises authored comments to "Deleted user" (keep content for team history) or deletes per user's choice; removes avatar objects; finally deletes `auth.users` row via the admin API in a server action (service role, server-only) after the RPC succeeds. Typed confirmation required.
- **Export my data** (JSON): profile, memberships, tasks created, comments, XP events — streamed by a route handler under RLS.
- Tests for both (pgTAP + Playwright).

### Step 9 — Production deployment
1. Verify production Supabase: all migrations pushed (`supabase migration list --linked` shows parity), Auth URLs correct, email confirmation on, Google OAuth configured, storage buckets & policies present, realtime publication correct, Security Advisor clean.
2. Vercel: production env vars set (§J.7), Preview env vars pointing at dev project, `main` protected (PR + CI required).
3. GitHub Actions: `ci.yml` (lint, typecheck, unit, pgTAP, build), `e2e.yml` (`@smoke` on PR against preview, `@full` nightly), `lighthouse.yml`, `daily.yml` (cron ping with `CRON_SECRET`, alerts on failure via the workflow failing → GitHub email), `gitleaks.yml`.
4. Deploy `main`. Smoke test production manually and with `@smoke` against the production URL using a dedicated test account: signup, onboarding, create project, task move, realtime between two browsers, notification, Pulse, analytics, AI (fallback and, if key set, AI), CSV export.
5. Confirm `/api/health` returns ok; confirm daily workflow run succeeded once (trigger with `workflow_dispatch`).
6. **Demo workspace:** the student and teammates create real accounts and use the app on an actual mini-project for ≥ 7 days before evaluation (or as long as available) so analytics reflect genuine activity. Document this in the report as the pilot study.
7. Free-tier monitoring checklist in `FREE_TIER_SERVICES.md` (Supabase usage page: DB size, egress, MAU, realtime; Vercel usage; Gemini quota) — record current usage numbers and date in the tracker.
8. Record deployment URL, commit SHA, date, and verification results in the tracker **only after confirming they work**.

### Step 10 — Documentation
1. **README.md** (root): banner/screenshot, tagline, live demo link, feature list (MVP + innovation highlights), architecture diagram (Mermaid from §C.1), tech stack with reasons, screenshots grid (light/dark, mobile), local setup (step-by-step from §J.2 with Docker and no-Docker paths), environment variables table, database & migrations, running tests (all suites), deployment guide, free-tier notes, project structure, scripts, troubleshooting (§J.9), security summary, roadmap, academic context, license (MIT), author (student name).
2. `docs/` tree:
   - `docs/architecture.md` (C), `docs/database.md` (ERD, tables, RLS summary, functions), `docs/api.md` (Server Actions & routes), `docs/algorithms/` (pseudocode + worked examples + complexity), `docs/security/audit.md`, `docs/testing/` (strategy, traceability, results, coverage, accessibility, performance), `docs/user-guide.md` (end-user manual with screenshots), `docs/deployment.md`.
3. **Academic report** `docs/report/TeamSync_Report.md` following §K chapter structure, filled with real content: abstract with results, literature review with ≥ 8 properly cited sources (IEEE style; include access dates for web sources), requirements, design diagrams (architecture, ER, DFD L0/L1, use case, sequence diagrams for move-task, invite, AI), algorithms with worked numeric examples from the pilot, implementation highlights with short code excerpts, testing tables (test ID, description, expected, actual, status) generated from real runs, results (pilot metrics: tasks, completion rate, Pulse trend, rebalances applied — measured, not invented), limitations, conclusion, future work. Note: the student must review and personalise the report; mark sections needing their input with `> TODO(student): …`.
4. **Presentation** `docs/presentation/TeamSync_Slides.md` — 12–15 slide outline with speaker notes: problem, solution, demo flow, architecture, database & RLS, Pulse algorithm, workload engine, dependency validation, AI with fallback, gamification, testing results, deployment & free-tier, challenges, future work, Q&A prep (20 likely viva questions with concise answers, e.g., "How do you prevent one workspace seeing another's data?", "What happens when Gemini is down?", "Why is XP awarded in the database?").
5. **Demo script** `docs/presentation/demo-script.md`: 7-minute live demo with exact clicks, two-browser realtime moment, backup plan (recorded video path, screenshots) if internet/Supabase fails.
6. Update `IMPLEMENTATION_TRACKER.md` completely.

### Step 11 — Final acceptance testing
1. Fresh-clone test: clone into a new folder, follow README exactly, reach a working local app and green tests. Fix README until this works verbatim.
2. Run the full verification block (Section 7).
3. Score the project against §L evaluation matrix in `docs/evaluation.md` with evidence links for each criterion and honest gaps.
4. Tag release `v1.0.0` and create a GitHub Release with notes and screenshots.

---

## 5. Deliverables

- Complete test suites with reports (coverage HTML, Playwright HTML report, pgTAP output, Lighthouse reports, axe results) referenced from `docs/testing/`.
- Security audit document with all findings resolved or justified.
- Performance and accessibility reports with before/after.
- Account deletion and data export features.
- Production deployment (verified), CI/CD workflows, keep-alive.
- README, docs tree, academic report draft, presentation outline, demo script, evaluation self-assessment.
- Fully updated tracker; release `v1.0.0`.

## 6. Acceptance Criteria

| # | Criterion | Verification |
|---|---|---|
| AC1 | Every MVP requirement has ≥ 1 automated test; traceability matrix complete | `docs/testing/traceability.md` |
| AC2 | Coverage: `lib/algorithms` ≥ 90 %, `lib` ≥ 70 % | coverage report |
| AC3 | pgTAP isolation matrix passes for every table and role | `npm run db:test` |
| AC4 | Security: §H.3 queries 0 rows; Advisor clean; ZAP no high/medium unresolved; no secrets in bundle/history; IDOR/XSS/upload tests pass | `docs/security/audit.md` |
| AC5 | Lighthouse: landing ≥ 90 (all), dashboard perf ≥ 80; CLS < 0.1 | Lighthouse CI reports |
| AC6 | 0 serious/critical axe violations on all routes in both themes; keyboard & SR checks documented | accessibility report |
| AC7 | No horizontal overflow on any route at 360 px; mobile flows usable | Playwright responsive suite + device screenshots |
| AC8 | Every route has loading/error/not-found states; no raw errors shown | manual checklist + error-path tests |
| AC9 | Production deployment verified live with smoke suite green against production URL | tracker entry with URL, SHA, date, test output |
| AC10 | App remains fully functional with `GEMINI_API_KEY` unset in production-like env | E2E fallback run |
| AC11 | Daily workflow ran successfully at least once; health endpoint OK | Actions run link |
| AC12 | Fresh clone → README → working app & green tests | documented run |
| AC13 | Report, slides, demo script, user guide complete (student TODOs clearly marked) | docs review |
| AC14 | Tracker fully updated; release v1.0.0 tagged | GitHub |

## 7. Completion Verification (run all, paste summaries into the tracker)

```bash
# Code quality & tests
npm ci
npm run lint && npm run typecheck
npm test -- --coverage
npm run build
npm run db:reset && npm run db:test
npm run test:e2e                                   # full suite locally
PLAYWRIGHT_BASE_URL=https://<production-url> npx playwright test --grep @smoke

# Security
grep -r "service_role\|GEMINI_API_KEY\|CRON_SECRET" .next/static || echo "OK"
npm audit --omit=dev
curl -sI https://<production-url> | grep -Ei "content-security-policy|x-content-type-options|referrer-policy"

# Deployment health
curl -s https://<production-url>/api/health
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<production-url>/api/cron/daily   # expect 401
```

Plus SQL (production, via Supabase SQL editor):

```sql
select tablename from pg_tables where schemaname='public' and rowsecurity=false;   -- 0 rows
select count(*) from supabase_migrations.schema_migrations;                         -- equals local migration count
```

Phase 4 is complete only when every acceptance criterion is green **and** evidenced in the tracker. If any item cannot be completed in this environment, list it under *Pending tasks* with exact instructions for the student.
