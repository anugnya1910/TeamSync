import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiSummaryCard } from "@/components/ai/ai-summary-card";
import { ProjectOverview } from "@/components/project/project-overview";
import { getProjectIntel } from "@/lib/intelligence/project.server";
import { getProjectBundle } from "@/lib/data/project";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectOverviewPage({ params }: PageProps<"/w/[workspaceSlug]/p/[projectKey]">) {
  const { workspaceSlug, projectKey } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const bundle = await getProjectBundle(workspace.id, projectKey);
  if (!bundle) notFound();
  const intel = await getProjectIntel(bundle.project.id, profile.timezone);
  if (!intel) notFound();
  const supabase = await createClient();
  const { data: snaps } = await supabase
    .from("project_health_snapshots")
    .select("snapshot_date, score, updated_at")
    .eq("project_id", bundle.project.id)
    .order("snapshot_date", { ascending: false })
    .limit(30);
  const trend = (snaps ?? []).slice().reverse().map((s) => ({ date: s.snapshot_date, score: s.score }));
  return (
    <ProjectOverview
      intel={{
        pulse: intel.pulse,
        risks: intel.risks,
        taskKeyById: Object.fromEntries(intel.data.tasks.map((t) => [t.id, t.key ?? ""])),
        forecasts: intel.milestoneForecasts,
        trend,
        updatedAt: snaps?.[0]?.updated_at ?? new Date().toISOString(),
      }}
      aiSlot={workspace.ai_enabled ? <AiSummaryCard projectId={bundle.project.id} /> : null}
    />
  );
}
