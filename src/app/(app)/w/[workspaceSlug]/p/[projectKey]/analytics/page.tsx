import { formatInTimeZone } from "date-fns-tz";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectAnalyticsView } from "@/components/analytics/project-analytics";
import { getProjectBundle } from "@/lib/data/project";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { buildProjectAnalytics, isPeriodKey, periodRange } from "@/lib/intelligence/analytics";
import { getProjectIntel } from "@/lib/intelligence/project.server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project analytics" };

export default async function ProjectAnalyticsPage({ params, searchParams }: PageProps<"/w/[workspaceSlug]/p/[projectKey]/analytics">) {
  const [{ workspaceSlug, projectKey }, sp] = await Promise.all([params, searchParams]);
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const bundle = await getProjectBundle(workspace.id, projectKey);
  if (!bundle) notFound();
  const intel = await getProjectIntel(bundle.project.id, profile.timezone);
  if (!intel) notFound();
  const { data } = intel;

  const period = isPeriodKey(sp.range) ? sp.range : "30";
  const milestoneId = typeof sp.ms === "string" && data.milestones.some((m) => m.id === sp.ms) ? sp.ms : null;
  const range = periodRange(period, data.today, data.historyStart);
  // Pad by a day either side: local dates are derived after fetching UTC timestamps.
  const since = new Date(`${range.start}T00:00:00Z`).getTime() - 86_400_000;
  const sinceIso = new Date(since).toISOString();
  const local = (iso: string) => formatInTimeZone(new Date(iso), data.tz, "yyyy-MM-dd");

  const supabase = await createClient();
  const [comments, reviews, snaps] = await Promise.all([
    supabase.from("comments").select("author_id, created_at").eq("project_id", bundle.project.id).is("deleted_at", null).gte("created_at", sinceIso).limit(10000),
    supabase
      .from("task_status_history")
      .select("changed_by, changed_at")
      .eq("project_id", bundle.project.id)
      .eq("from_status", "in_review")
      .eq("to_status", "done")
      .gte("changed_at", sinceIso)
      .limit(10000),
    supabase.from("project_health_snapshots").select("snapshot_date, score").eq("project_id", bundle.project.id).gte("snapshot_date", range.start).order("snapshot_date").limit(400),
  ]);

  const analytics = buildProjectAnalytics({
    tasks: data.tasks,
    history: data.history,
    members: data.members,
    workload: intel.workload.members,
    risks: intel.risks,
    today: data.today,
    historyStart: data.historyStart,
    targetDate: data.project.target_date,
    comments: (comments.data ?? []).map((c) => ({ authorId: c.author_id, date: local(c.created_at) })),
    reviews: (reviews.data ?? []).map((r) => ({ userId: r.changed_by, date: local(r.changed_at) })),
    snapshots: (snaps.data ?? []).map((s) => ({ date: s.snapshot_date, score: s.score })),
    period,
    milestoneId,
  });

  return <ProjectAnalyticsView analytics={analytics} milestones={data.milestones.map((m) => ({ id: m.id, name: m.name }))} milestoneId={milestoneId} />;
}
