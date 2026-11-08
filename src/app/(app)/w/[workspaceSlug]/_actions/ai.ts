"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { pgFail, withSession } from "@/lib/actions/shared";
import { addDaysIso } from "@/lib/algorithms/common";
import { clientInsert } from "@/lib/db-insert";
import { breakdownSchema, planSchema } from "@/lib/ai/schemas";
import { uuidSchema } from "@/lib/validation/phase2";

/** Creates previewed subtasks (re-validated; inserted as normal tasks so triggers & RLS apply). */
const applyBreakdownSchema = z.object({ taskId: uuidSchema, plan: breakdownSchema });
export async function applyAiBreakdown(input: z.input<typeof applyBreakdownSchema>): Promise<ActionResult<{ created: number }>> {
  return withSession(applyBreakdownSchema, input, async ({ data, supabase }) => {
    const { data: parent } = await supabase.from("tasks").select("id, project_id, milestone_id, parent_task_id").eq("id", data.taskId).maybeSingle();
    if (!parent) return fail("NOT_FOUND", "Task not found.");
    if (parent.parent_task_id) return fail("VALIDATION", "Subtasks can't have their own subtasks.");
    const rows = data.plan.subtasks.map((s) =>
      clientInsert("tasks", { project_id: parent.project_id, parent_task_id: parent.id, milestone_id: parent.milestone_id, title: s.title, effort_points: s.effort }),
    );
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) return pgFail(error);
    await logApplied(supabase, parent.project_id, "breakdown", rows.length);
    return ok({ created: rows.length });
  });
}

/** Applies a previewed project plan: milestones (lead) + tasks. */
const applyPlanSchema = z.object({ projectId: uuidSchema, startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), plan: planSchema });
export async function applyAiPlan(input: z.input<typeof applyPlanSchema>): Promise<ActionResult<{ milestones: number; tasks: number }>> {
  return withSession(applyPlanSchema, input, async ({ data, supabase }) => {
    const { data: isLead } = await supabase.rpc("is_project_lead", { p: data.projectId });
    if (!isLead) return fail("FORBIDDEN", "Only the project lead can apply a plan with milestones.");
    let tasks = 0;
    for (const [i, m] of data.plan.milestones.entries()) {
      const { data: ms, error } = await supabase
        .from("milestones")
        .insert(clientInsert("milestones", { project_id: data.projectId, name: m.name, due_date: addDaysIso(data.startDate, m.dueOffsetDays), sort_order: 100 + i }))
        .select("id")
        .single();
      if (error) return pgFail(error);
      const rows = m.tasks.map((t) =>
        clientInsert("tasks", { project_id: data.projectId, milestone_id: ms.id, title: t.title, description: t.description || null, priority: t.priority, effort_points: t.effort, status: "backlog" }),
      );
      const { error: tErr } = await supabase.from("tasks").insert(rows);
      if (tErr) return pgFail(tErr);
      tasks += rows.length;
    }
    await logApplied(supabase, data.projectId, "plan_project", tasks);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok({ milestones: data.plan.milestones.length, tasks });
  });
}

const prioritySchema = z.object({
  projectId: uuidSchema,
  changes: z.array(z.object({ taskId: uuidSchema, priority: z.enum(["urgent", "high", "medium", "low", "none"]) })).min(1).max(20),
});
export async function applyAiPriorities(input: z.input<typeof prioritySchema>): Promise<ActionResult<{ updated: number }>> {
  return withSession(prioritySchema, input, async ({ data, supabase }) => {
    let updated = 0;
    for (const c of data.changes) {
      const { data: row, error } = await supabase.from("tasks").update({ priority: c.priority }).eq("id", c.taskId).eq("project_id", data.projectId).select("id").maybeSingle();
      if (error) return pgFail(error);
      if (row) updated++;
    }
    await logApplied(supabase, data.projectId, "priorities", updated);
    return ok({ updated });
  });
}

/** Activity row "AI suggestion applied" (spec §B.15), via a permission-checked RPC. */
async function logApplied(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>, projectId: string, kind: "breakdown" | "plan_project" | "priorities", count: number) {
  await supabase.rpc("log_ai_applied", { p_project: projectId, p_kind: kind, p_count: count });
}
