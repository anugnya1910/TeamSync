# TeamSync — Free-Tier Services

> Researched **8 November 2026** from public pricing/docs pages and recent third-party summaries. Free tiers change without notice — **re-check each provider's official pricing page before deploying and again before evaluation**, and record the check date in `IMPLEMENTATION_TRACKER.md` §14.
>
> **Policy:** every *required* service below works with no billing method attached. Anything whose free status is uncertain is optional and has a fallback. No paid API is a mandatory dependency.

---

## 1. Summary

| Service | Purpose | Required? | Free tier | Billing risk |
|---|---|---|---|---|
| Supabase Free | PostgreSQL, Auth, Realtime, Storage, RLS | **Yes** | Yes, no card needed | None while on Free plan (hard limits / pause, not overage) |
| Vercel Hobby | Hosting Next.js, serverless functions, previews | **Yes** | Yes, personal non-commercial | None on Hobby (limits pause, no auto-billing) |
| GitHub | Repo, Actions CI, scheduled keep-alive, Dependabot | **Yes** | Yes | None for public repos; private repos have a monthly Actions minutes allowance |
| Google Fonts via `next/font` | Bricolage Grotesque, Inter, JetBrains Mono | Yes | Free & open licences, self-hosted at build | None |
| Google OAuth (Google Cloud Console) | "Continue with Google" | Optional | Free | None (no billable APIs enabled) |
| Gemini API (Google AI Studio) | AI Task Assistant | **Optional** | Free tier for Flash / Flash-Lite class models | Low — only if billing is enabled on the Google project; **don't enable billing** |
| Open-source libraries (npm) | UI, DnD, charts, graph, testing | Yes | MIT/Apache/ISC licences | None |

Nothing else (email providers, monitoring SaaS, analytics SaaS, paid AI) is required.

---

## 2. Supabase (Free plan)

**Why:** single managed backend providing Postgres with Row Level Security (multi-tenant isolation), Auth (email + OAuth), Realtime (live board, presence, notifications) and Storage (avatars, attachments).

**Free-tier limits (as reported in 2026 sources; verify on supabase.com/pricing):**

| Resource | Free allowance | TeamSync expected usage |
|---|---|---|
| Active projects | 2 per account | dev + prod (or local Docker for dev, keeping 1 spare) |
| Database size | 500 MB per project | < 50 MB for a semester of team use |
| File storage | ~1 GB (one source lists 500 MB — check dashboard) | avatars + small attachments, < 200 MB with 5 MB cap per file |
| Egress | ~5 GB / month | low; avoid large downloads |
| Auth MAU | 50,000 | tens of users |
| Realtime | ~200 concurrent connections, ~2 M messages / month | < 30 concurrent |
| Edge Functions | ~500 K invocations / month | **not used** (Next.js route handlers instead) |
| API requests | unlimited | — |
| Inactivity pause | project pauses after **7 days** of no activity | mitigated by daily cron ping |
| Backups | no daily backups on Free | export SQL dump before evaluation (`supabase db dump`) |

**Configuration**
- Create project `teamsync-prod` (region nearest users, e.g. Mumbai if listed).
- Auth → URL configuration: Site URL = production URL; redirect URLs = `http://localhost:3000/**`, `https://<prod-domain>/**`, Vercel preview wildcard.
- Providers: Email (confirmations ON in prod), Google (client ID/secret from Google Cloud).
- Migrations: `supabase link --project-ref <ref>` → `supabase db push`.
- Storage buckets and Realtime publication are created by migrations.

**Environment variables**

| Variable | Exposure |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or newer publishable key) | public — safe only because RLS protects every table |
| `SUPABASE_SERVICE_ROLE_KEY` (or newer secret key) | **server only**, used solely in `/api/cron/*` and account deletion |

**Quota risks & mitigations**
- *Auto-pause* → GitHub Actions daily workflow calls `/api/cron/daily` (real DB work). Check the project 24 h before any demo. GitHub disables scheduled workflows in repositories with no activity for 60 days — keep committing or re-enable.
- *500 MB DB* → no binary data in Postgres; activity logs pruned after 180 days; read notifications pruned after 90 days; snapshots are one small row per project per day.
- *Built-in email sender is heavily rate-limited* → invites work by copyable link; disable email confirmation for local dev; for production, optionally configure a custom SMTP from any provider with a genuinely free tier (optional; verify its terms).
- *Realtime connections* → one socket per tab, channels unsubscribed on navigation.

**Billing risk:** None on the Free plan — limits cause restriction/pausing rather than charges. Do **not** upgrade the organisation or add spend caps changes.

**Fallback:** Local Supabase via Docker for development; if the cloud project is paused at demo time, restore from dashboard (takes minutes) or run the demo locally against `supabase start` with a pre-recorded video as backup.

---

## 3. Vercel (Hobby plan)

**Why:** zero-config Next.js hosting, preview deployment per PR, serverless functions for Server Actions and route handlers.

**Free-tier limits (verify at vercel.com/pricing and vercel.com/docs/plans/hobby):**

| Resource | Hobby allowance (2026 sources) | Notes |
|---|---|---|
| Permitted use | **Personal, non-commercial only** | academic project qualifies; no ads/payments |
| Bandwidth / fast data transfer | ~100 GB / month | ample |
| Function invocations | sources report 100 K – 1 M / month | ample for a class project |
| Function duration | default short (≈10 s) — sources differ on max | AI calls time out at 8 s → fallback; cron processes in small idempotent batches |
| Deployments | ~100 / day | fine |
| Seats | 1 | teammates contribute via GitHub; one person owns the Vercel project |
| Overage | no auto-billing on Hobby; exceeding limits pauses features | |

**Configuration:** import GitHub repo → framework preset Next.js → env vars for *Production* (prod Supabase) and *Preview* (dev Supabase) → protect `main`.

**Environment variables:** all from spec §J.7 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, optional `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_GLOBAL_DAILY_LIMIT`, `APP_DEFAULT_TZ`).

**Quota risks:** long-running functions (avoid), image optimisation volume (avatars are small; use `sizes`), bundle size (code-split heavy libs).

**Billing risk:** None on Hobby. Commercial use would breach terms — keep the project academic.

**Fallback:** Netlify or Cloudflare Pages free tiers can host Next.js with adapters (extra setup); or run `next build && next start` on a local machine for the demo.

---

## 4. GitHub

**Why:** source control, PR workflow, **GitHub Actions** (CI, Playwright, Lighthouse, daily keep-alive cron), Dependabot, gitleaks secret scanning.

**Free-tier limits:** public repositories get free Actions minutes on standard runners; private repositories on the Free plan get a monthly minutes allowance (historically 2,000 min/month — verify). TeamSync CI ≈ 6–10 min per run.

**Configuration:** repository secrets `CRON_SECRET`, `APP_URL`, `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD` (test account only). Commits authored with the student's own Git identity.

**Quota risks:** heavy Playwright matrices on private repos — run `@full` nightly, `@smoke` on PRs.

**Billing risk:** None unless a payment method is added and spending limits raised. Leave the spending limit at $0.

**Fallback:** run tests locally; trigger cron manually via `curl` before demos.

---

## 5. Gemini API (Google AI Studio) — OPTIONAL

**Why:** drafts task breakdowns and project summaries (MVP), plans/priorities/risk narratives (Advanced).

**Free-tier status (Nov 2026 sources):**
- Free tier exists through Google AI Studio for **Flash and Flash-Lite class models only**; Pro/flagship models are paid-only.
- Rate limits are per project and vary by model; recent sources cite roughly **15 requests/min and up to ~1,500 requests/day** for Flash on the free tier, but Google has cut free limits before without notice. Check the "Rate limits" page in AI Studio for your key.
- Model names change frequently (older Flash models have been retired) → TeamSync reads the model from `GEMINI_MODEL`; choose a currently free-tier Flash/Flash-Lite model at deploy time.
- **Data use:** free-tier prompts may be used by Google to improve products. TeamSync therefore sends only task titles, descriptions and computed statistics — never emails, attachments, or profile data — and shows a disclosure in workspace AI settings.
- Google Cloud's welcome credit is separate and is not needed.

**Configuration:** create an API key in Google AI Studio **without enabling billing**; set `GEMINI_API_KEY` and `GEMINI_MODEL` in Vercel (server-side only).

**Quota controls in TeamSync:**

| Control | Default | Where |
|---|---|---|
| Per user per day | 20 requests | `consume_ai_quota` RPC |
| Per workspace per day | `workspaces.ai_daily_limit` = 100 | RPC |
| Global per day | `AI_GLOBAL_DAILY_LIMIT` = 200 (keep well under provider RPD) | route handler |
| Request timeout | 8 s | `gemini.ts` |
| Input size | ≤ 8 KB body, context truncated | route handler |

**Quota risks:** 429 responses, model retirement, limit reductions → all handled by fallback.

**Billing risk:** Low. Charges only occur if billing is enabled on the Google Cloud project behind the key. **Do not attach a billing account.**

**Fallback (always available):** deterministic rule-based generators in `src/lib/ai/fallbacks.ts` for every AI feature; UI labels results "Rules-based". The application is fully functional with `GEMINI_API_KEY` unset (tested in Phase 3 & 4).

---

## 6. Google OAuth — OPTIONAL

**Why:** one-click sign-in. **Free.** Create an OAuth client (Web) in Google Cloud Console, consent screen in *Testing* or *Production* (basic scopes: email, profile, openid need no verification for basic use); add Supabase callback URL. No billable APIs enabled.
**Fallback:** email/password auth (always on). Button hidden when `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` ≠ `true`.

---

## 7. Open-Source Libraries (no service, no quota)

| Library | Licence | Use |
|---|---|---|
| Next.js, React | MIT | framework |
| Tailwind CSS | MIT | styling |
| shadcn/ui (copied components), Radix UI | MIT | primitives |
| Lucide React | ISC | icons |
| Framer Motion (motion) | MIT | animation |
| Recharts | MIT | charts |
| @dnd-kit | MIT | drag and drop |
| @xyflow/react (React Flow) | MIT | dependency map |
| dagre / elkjs | MIT / EPL-2.0 | graph layout |
| TanStack Query / Virtual | MIT | data & virtualisation |
| react-hook-form, zod | MIT | forms & validation |
| react-markdown, remark-gfm, rehype-sanitize | MIT | safe markdown |
| date-fns, date-fns-tz | MIT | dates |
| cmdk, vaul, sonner, next-themes | MIT | palette, drawer, toasts, theming |
| Vitest, Testing Library, Playwright, axe-core | MIT / Apache-2.0 / MPL-2.0 | testing |
| pgTAP (via Supabase CLI) | PostgreSQL licence | DB tests |
| Lighthouse CI, OWASP ZAP, gitleaks | Apache-2.0 / MIT | audits |

---

## 8. Explicitly Excluded

| Not used | Reason |
|---|---|
| Paid AI APIs / Gemini Pro-tier models | cost; free Flash tier + fallback suffices |
| Supabase Pro, Vercel Pro | not needed; would require billing |
| Paid email services as hard dependency | invite links work without email |
| Paid monitoring (Sentry paid, Datadog) | Vercel logs + Supabase logs suffice; Sentry's free developer tier may be added later as **optional** only |
| Vercel Cron as the only scheduler | Hobby cron frequency is restricted; GitHub Actions schedule used instead |
| Supabase Edge Functions | unnecessary; keeps one runtime |

---

## 9. Pre-Evaluation Checklist (run 24–48 h before demo)

- [ ] Supabase project **active** (not paused); usage page within limits; DB size recorded
- [ ] `supabase db dump` backup saved locally
- [ ] Vercel production deploy green; `/api/health` OK
- [ ] Daily GitHub workflow succeeded in last 24 h
- [ ] Gemini key works (or confirm fallback mode demo-ready); today's AI request count low
- [ ] Demo accounts can log in; email confirmations not needed for demo accounts
- [ ] Recorded demo video available offline as backup

## 10. Sources consulted (8 Nov 2026)

- Supabase pricing summaries: makerkit.dev/blog/saas/supabase-pricing, cloudzero.com/blog/supabase-pricing, jetadmin.io Supabase pricing 2026 guide
- Vercel: vercel.com/docs/plans/hobby, vercel.com/pricing
- Gemini API: ai.google.dev pricing & rate-limit pages (via morphllm.com/gemini-api-pricing, tinkerllm.com free-tier guide, cometapi.com free-tier overview)

Always prefer the official pages over summaries when they disagree.
