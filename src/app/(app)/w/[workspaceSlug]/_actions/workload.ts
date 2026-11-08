"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { pgFail, withSession } from "@/lib/actions/shared";
import { analyse, loadProjectData, recentlyHandledTasks } from "@/lib/intelligence/project.server";
import { recommendationRows } from "@/lib/intelligence/recommendations";
import { uuidSchema } from "@/lib/validation/phase2";

/** Recomputes suggestions (spec §G.2) and replaces the open set. Leads only (enforced in SQL). */
export async function refreshWorkloadSuggestions(projectId: string): Promise<ActionResult<{ count: number }>> {
  return withSession(uuidSchema, projectId, async ({ data: id, supabase, userId }) => {
    const { data: prof } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
    const pd = await loadProjectData(supabase, id, prof?.timezone ?? "UTC");
    if (!pd) return fail("NOT_FOUND", "Project not found.");
    const intel = analyse(pd, await recentlyHandledTasks(supabase, id));
    const { data: count, error } = await supabase.rpc("save_workload_recommendations", {
      p_project: id,
      p_items: recommendationRows(intel.suggestions),
    });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]/workload", "page");
    return ok({ count: count ?? 0 });
  });
}

export async function applyWorkloadSuggestion(id: string): Promise<ActionResult<{ taskId: string }>> {
  return withSession(uuidSchema, id, async ({ data, supabase }) => {
    const { data: task, error } = await supabase.rpc("apply_workload_recommendation", { p_id: data });
    if (error) return pgFail(error);
    // NULL = the task changed since the suggestion was made; the row is now marked stale.
    if (!task || !(task as { id?: string | null }).id) return fail("CONFLICT", "This suggestion is out of date — the task changed since it was made. Refresh suggestions.");
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]/workload", "page");
    return ok({ taskId: (task as { id: string }).id });
  });
}

export async function dismissWorkloadSuggestion(id: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, id, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("dismiss_workload_recommendation", { p_id: data });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]/workload", "page");
    return ok(null);
  });
}
