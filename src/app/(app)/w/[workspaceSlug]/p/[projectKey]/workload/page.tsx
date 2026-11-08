import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkloadView, type SavedSuggestion } from "@/components/workload/workload-view";
import { getProjectBundle } from "@/lib/data/project";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { getProjectIntel } from "@/lib/intelligence/project.server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workload balance" };

type Details = { task_key?: string; task_title?: string; from_before?: number; from_after?: number; to_before?: number; to_after?: number };

export default async function WorkloadPage({ params }: PageProps<"/w/[workspaceSlug]/p/[projectKey]/workload">) {
  const { workspaceSlug, projectKey } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const bundle = await getProjectBundle(workspace.id, projectKey);
  if (!bundle) notFound();
  const intel = await getProjectIntel(bundle.project.id, profile.timezone);
  if (!intel) notFound();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("workload_recommendations")
    .select("id, task_id, from_user_id, to_user_id, reason, imbalance_before, imbalance_after, details, created_at")
    .eq("project_id", bundle.project.id)
    .eq("status", "open")
    .order("imbalance_after", { ascending: true })
    .limit(10);
  const saved: SavedSuggestion[] = (rows ?? []).map((r) => {
    const d = (r.details ?? {}) as Details;
    return {
      id: r.id,
      taskId: r.task_id,
      taskKey: d.task_key ?? "",
      taskTitle: d.task_title ?? "",
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      reason: r.reason,
      imbalanceBefore: Number(r.imbalance_before),
      imbalanceAfter: Number(r.imbalance_after),
      fromAfter: d.from_after ?? null,
      toAfter: d.to_after ?? null,
      createdAt: r.created_at,
    };
  });
  return <WorkloadView workload={intel.workload} saved={saved} liveCount={intel.suggestions.length} />;
}
