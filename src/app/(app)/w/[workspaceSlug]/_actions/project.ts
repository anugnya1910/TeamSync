"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { pgFail, withSession } from "@/lib/actions/shared";
import { clientInsert } from "@/lib/db-insert";
import {
  colorSchema,
  createProjectSchema,
  labelSchema,
  milestoneSchema,
  projectRoleSchema,
  updateProjectSchema,
  uuidSchema,
} from "@/lib/validation/phase2";

export async function createProject(input: z.input<typeof createProjectSchema>): Promise<ActionResult<{ key: string; id: string }>> {
  return withSession(createProjectSchema, input, async ({ data, supabase }) => {
    const { data: project, error } = await supabase.rpc("create_project", {
      p_workspace: data.workspaceId,
      p_name: data.name,
      p_key: data.key,
      p_description: data.description,
      p_visibility: data.visibility,
      p_start: data.startDate ?? undefined,
      p_target: data.targetDate ?? undefined,
      p_team: data.teamId ?? undefined,
      p_template: data.template,
      p_icon: data.icon,
      p_color: data.color,
    });
    if (error || !project) {
      if (error?.message?.includes("CONFLICT")) {
        return fail("CONFLICT", "That key is already used in this workspace.", { key: ["Key already used"] });
      }
      return pgFail(error);
    }
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok({ key: project.key, id: project.id });
  });
}

export async function updateProject(input: z.input<typeof updateProjectSchema>): Promise<ActionResult<null>> {
  return withSession(updateProjectSchema, input, async ({ data, supabase }) => {
    const { data: row, error } = await supabase
      .from("projects")
      .update({
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        color: data.color,
        visibility: data.visibility,
        status: data.status,
        start_date: data.startDate,
        target_date: data.targetDate,
      })
      .eq("id", data.projectId)
      .select("id")
      .maybeSingle();
    if (error) return pgFail(error);
    if (!row) return fail("FORBIDDEN", "Only project leads can edit project details.");
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

const wipSchema = z.object({
  projectId: uuidSchema,
  limits: z.partialRecord(z.enum(["backlog", "todo", "in_progress", "in_review", "done"]), z.number().int().min(1).max(500).nullable()),
});
export async function updateWipLimits(input: z.input<typeof wipSchema>): Promise<ActionResult<null>> {
  return withSession(wipSchema, input, async ({ data, supabase }) => {
    const limits = Object.fromEntries(Object.entries(data.limits).filter(([, v]) => v !== null));
    const { error } = await supabase.from("projects").update({ wip_limits: limits }).eq("id", data.projectId);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

const archiveSchema = z.object({ projectId: uuidSchema, archived: z.boolean() });
export async function setProjectArchived(input: z.input<typeof archiveSchema>): Promise<ActionResult<null>> {
  return withSession(archiveSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("set_project_archived", { p_project: data.projectId, p_archived: data.archived });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

export async function deleteProject(projectId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, projectId, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("delete_project", { p_project: data });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]", "layout");
    return ok(null);
  });
}

const memberSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema,
  role: projectRoleSchema,
  capacity: z.coerce.number().int().min(0).max(200),
});
export async function setProjectMember(input: z.input<typeof memberSchema>): Promise<ActionResult<null>> {
  return withSession(memberSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("set_project_member", {
      p_project: data.projectId,
      p_user: data.userId,
      p_role: data.role,
      p_capacity: data.capacity,
    });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

const removeMemberSchema = z.object({ projectId: uuidSchema, userId: uuidSchema });
export async function removeProjectMember(input: z.input<typeof removeMemberSchema>): Promise<ActionResult<null>> {
  return withSession(removeMemberSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("remove_project_member", { p_project: data.projectId, p_user: data.userId });
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

export async function createMilestone(input: z.input<typeof milestoneSchema>): Promise<ActionResult<{ id: string }>> {
  return withSession(milestoneSchema, input, async ({ data, supabase }) => {
    const { data: row, error } = await supabase
      .from("milestones")
      .insert(clientInsert("milestones", { project_id: data.projectId, name: data.name, description: data.description || null, due_date: data.dueDate }))
      .select("id")
      .single();
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok({ id: row.id });
  });
}

const updateMilestoneSchema = milestoneSchema.omit({ projectId: true }).extend({
  milestoneId: uuidSchema,
  status: z.enum(["open", "completed"]),
});
export async function updateMilestone(input: z.input<typeof updateMilestoneSchema>): Promise<ActionResult<null>> {
  return withSession(updateMilestoneSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase
      .from("milestones")
      .update({ name: data.name, description: data.description || null, due_date: data.dueDate, status: data.status })
      .eq("id", data.milestoneId);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, milestoneId, async ({ data, supabase }) => {
    const { error } = await supabase.from("milestones").delete().eq("id", data);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

export async function createLabel(input: z.input<typeof labelSchema>): Promise<ActionResult<{ id: string }>> {
  return withSession(labelSchema, input, async ({ data, supabase }) => {
    const { data: row, error } = await supabase
      .from("labels")
      .insert(clientInsert("labels", { project_id: data.projectId, name: data.name, color: data.color }))
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return fail("CONFLICT", "A label with that name already exists.", { name: ["Name already used"] });
      return pgFail(error);
    }
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok({ id: row.id });
  });
}

const updateLabelSchema = z.object({ labelId: uuidSchema, name: z.string().trim().min(1).max(30), color: colorSchema });
export async function updateLabel(input: z.input<typeof updateLabelSchema>): Promise<ActionResult<null>> {
  return withSession(updateLabelSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.from("labels").update({ name: data.name, color: data.color }).eq("id", data.labelId);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}

export async function deleteLabel(labelId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, labelId, async ({ data, supabase }) => {
    const { error } = await supabase.from("labels").delete().eq("id", data);
    if (error) return pgFail(error);
    revalidatePath("/w/[workspaceSlug]/p/[projectKey]", "layout");
    return ok(null);
  });
}
