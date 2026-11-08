import { formatInTimeZone } from "date-fns-tz";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { analyse, loadProjectData, recentlyHandledTasks, snapshotPayload } from "@/lib/intelligence/project.server";
import { recommendationRows } from "@/lib/intelligence/recommendations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Hobby plan allows up to 60 s; the loop stops at a 45 s budget and reports `truncated`.
export const maxDuration = 60;

/**
 * Daily jobs (spec §C.8, §J.5). Called by .github/workflows/daily.yml with CRON_SECRET.
 * Idempotent per date: re-running creates no duplicate notifications. Also keeps the free
 * Supabase project active. The service-role client is used ONLY here.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const date = formatInTimeZone(new Date(), serverEnv.APP_DEFAULT_TZ, "yyyy-MM-dd");
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("generate_due_notifications", { p_date: date });
    if (error) throw error;
    const counts = data?.[0] ?? { due_soon: 0, overdue: 0 };
    const extra = await runPhaseExtensions(admin, date);
    logger.info("cron daily done", { date, ...counts, ...extra });
    return NextResponse.json({ date, notifications: counts, ...extra }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    logger.error("cron daily failed", { date, message: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: "job failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}

const PAGE = 50;
const TIME_BUDGET_MS = 45_000;

/**
 * Phase 3 (spec §B.19, §B.21): per non-archived project — Pulse snapshot, refreshed workload
 * suggestions, and one `rebalance_suggested` notice per lead per project per day when there are
 * suggestions. Then prune old rows (§M R4). Idempotent: snapshots upsert by (project, date),
 * suggestions replace the open set, notices are de-duplicated by day.
 */
async function runPhaseExtensions(admin: ReturnType<typeof createAdminClient>, date: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  const tz = serverEnv.APP_DEFAULT_TZ;
  let after: string | null = null;
  let snapshots = 0;
  let suggestionSets = 0;
  let notices = 0;
  let failures = 0;
  let truncated = false;
  const slugs = new Map<string, string>();

  for (;;) {
    // p_after is nullable in SQL (first page); the generated Args type can't express that.
    const cursor = after as string;
    const { data: rows, error: pageErr } = await admin.rpc("active_projects_page", { p_after: cursor, p_limit: PAGE });
    if (pageErr) throw pageErr;
    const page: { id: string; workspace_id: string }[] = rows ?? [];
    if (!page.length) break;
    for (const p of page) {
      after = p.id;
      if (Date.now() - started > TIME_BUDGET_MS) {
        truncated = true;
        break;
      }
      try {
        const data = await loadProjectData(admin, p.id, tz);
        if (!data) continue;
        const intel = analyse(data, await recentlyHandledTasks(admin, p.id));
        const snap = snapshotPayload(intel.pulse);
        const { error: sErr } = await admin.rpc("upsert_health_snapshot", { p_project: p.id, p_date: date, ...snap, p_score: snap.p_score as number, p_stats: snap.p_stats });
        if (sErr) throw sErr;
        snapshots++;
        const { error: rErr } = await admin.rpc("save_workload_recommendations", { p_project: p.id, p_items: recommendationRows(intel.suggestions) });
        if (rErr) throw rErr;
        if (!intel.suggestions.length) continue;
        suggestionSets++;
        notices += await noticeLeads(admin, p.workspace_id, data.project.id, data.project.key, data.project.name, intel.suggestions.length, date, slugs);
      } catch (e) {
        failures++;
        logger.warn("cron project failed", { projectId: p.id, message: e instanceof Error ? e.message : "unknown" });
      }
    }
    if (truncated || page.length < PAGE) break;
  }

  const { data: pruned, error: pErr } = await admin.rpc("prune_old_data");
  if (pErr) throw pErr;
  return { snapshots, suggestionSets, notices, failures, truncated, pruned: pruned?.[0] ?? null };
}

async function noticeLeads(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  projectId: string,
  key: string,
  name: string,
  count: number,
  date: string,
  slugs: Map<string, string>,
): Promise<number> {
  let slug = slugs.get(workspaceId);
  if (!slug) {
    const { data: ws } = await admin.from("workspaces").select("slug").eq("id", workspaceId).single();
    slug = ws?.slug ?? "";
    slugs.set(workspaceId, slug);
  }
  const { data: leads } = await admin.from("project_members").select("user_id").eq("project_id", projectId).eq("role", "lead");
  let sent = 0;
  for (const l of leads ?? []) {
    const { count: already } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", l.user_id)
      .eq("type", "rebalance_suggested")
      .eq("entity_id", projectId)
      .gte("created_at", `${date}T00:00:00Z`);
    if (already) continue;
    const { error } = await admin.rpc("notify", {
      p_user: l.user_id,
      p_workspace: workspaceId,
      p_type: "rebalance_suggested",
      p_title: `${count} workload suggestion${count === 1 ? "" : "s"} for ${key}`,
      p_body: `Reassigning unstarted work in ${name} would even out the team's load. Review before anything changes.`,
      p_link: `/w/${slug}/p/${key}/workload`,
      p_entity: projectId,
    });
    if (!error) sent++;
  }
  return sent;
}
