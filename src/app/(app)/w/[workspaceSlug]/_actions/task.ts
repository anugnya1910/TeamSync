"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { pgFail, withSession } from "@/lib/actions/shared";
import { clientInsert } from "@/lib/db-insert";
import { commentSchema, createTaskSchema, uuidSchema } from "@/lib/validation/phase2";
import type { Tables } from "@/types/database";

/**
 * Task writes that span rows go through Server Actions → RPCs. Simple single-field edits
 * (title, priority, dates …) are done directly from the client under RLS (spec §E.3).
 */
export async function createTask(input: z.input<typeof createTaskSchema>): Promise<ActionResult<Tables<"tasks">>> {
  return withSession(createTaskSchema, input, async ({ data, supabase }) => {
    const { data: task, error } = await supabase
      .from("tasks")
      .insert(
        clientInsert("tasks", {
        project_id: data.projectId,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        due_date: data.dueDate,
        start_date: data.startDate,
        effort_points: data.effort,
        milestone_id: data.milestoneId,
        parent_task_id: data.parentTaskId,
        }),
      )
      .select("*")
      .single();
    if (error || !task) return pgFail(error);
    if (data.assigneeIds.length) {
      const { error: aErr } = await supabase.rpc("set_task_assignees", { p_task: task.id, p_users: data.assigneeIds });
      if (aErr) return pgFail(aErr);
    }
    if (data.labelIds.length) {
      const { error: lErr } = await supabase.rpc("set_task_labels", { p_task: task.id, p_labels: data.labelIds });
      if (lErr) return pgFail(lErr);
    }
    return ok(task);
  });
}

const moveSchema = z.object({
  taskId: uuidSchema,
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]),
  before: z.number().nullable(),
  after: z.number().nullable(),
  overrideReason: z.string().trim().max(300).nullable().optional(),
  clientMutationId: z.string().max(64).nullable().optional(),
});
export async function moveTask(input: z.input<typeof moveSchema>): Promise<ActionResult<Tables<"tasks">>> {
  return withSession(moveSchema, input, async ({ data, supabase }) => {
    const { data: task, error } = await supabase.rpc("move_task", {
      p_task: data.taskId,
      p_status: data.status,
      p_before: data.before ?? undefined,
      p_after: data.after ?? undefined,
      p_override_reason: data.overrideReason ?? undefined,
      p_client_mutation_id: data.clientMutationId ?? undefined,
    });
    if (error || !task) return pgFail(error);
    return ok(task);
  });
}

const idsSchema = z.object({ taskId: uuidSchema, ids: z.array(uuidSchema).max(50) });
export async function setAssignees(input: z.input<typeof idsSchema>): Promise<ActionResult<null>> {
  return withSession(idsSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("set_task_assignees", { p_task: data.taskId, p_users: data.ids });
    if (error) return pgFail(error);
    return ok(null);
  });
}

export async function setLabels(input: z.input<typeof idsSchema>): Promise<ActionResult<null>> {
  return withSession(idsSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("set_task_labels", { p_task: data.taskId, p_labels: data.ids });
    if (error) return pgFail(error);
    return ok(null);
  });
}

const bulkSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(500),
  patch: z
    .object({
      status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
      milestone_id: z.union([uuidSchema, z.literal("")]).optional(),
      due_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
      assignee_add: uuidSchema.optional(),
      assignee_remove: uuidSchema.optional(),
      delete: z.literal(true).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "Choose a change"),
});
export async function bulkUpdateTasks(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ updated: number }>> {
  return withSession(bulkSchema, input, async ({ data, supabase }) => {
    const { data: count, error } = await supabase.rpc("bulk_update_tasks", { p_ids: data.ids, p_patch: data.patch });
    if (error) return pgFail(error);
    return ok({ updated: count ?? 0 });
  });
}

export async function deleteTask(taskId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, taskId, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("delete_task", { p_task: data });
    if (error) return pgFail(error);
    return ok(null);
  });
}

export async function restoreTask(taskId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, taskId, async ({ data, supabase }) => {
    const { error } = await supabase.rpc("restore_task", { p_task: data });
    if (error) return pgFail(error);
    return ok(null);
  });
}

export async function duplicateTask(taskId: string): Promise<ActionResult<{ number: number }>> {
  return withSession(uuidSchema, taskId, async ({ data, supabase }) => {
    const { data: task, error } = await supabase.rpc("duplicate_task", { p_task: data });
    if (error || !task) return pgFail(error);
    return ok({ number: task.number });
  });
}

export async function addComment(input: z.input<typeof commentSchema>): Promise<ActionResult<{ id: string }>> {
  return withSession(commentSchema, input, async ({ data, supabase }) => {
    const { data: row, error } = await supabase
      .from("comments")
      .insert(clientInsert("comments", { task_id: data.taskId, body: data.body }))
      .select("id")
      .single();
    if (error) return pgFail(error);
    return ok({ id: row.id });
  });
}

const editCommentSchema = z.object({ commentId: uuidSchema, body: commentSchema.shape.body });
export async function editComment(input: z.input<typeof editCommentSchema>): Promise<ActionResult<null>> {
  return withSession(editCommentSchema, input, async ({ data, supabase }) => {
    const { error } = await supabase.from("comments").update({ body: data.body }).eq("id", data.commentId);
    if (error) return pgFail(error);
    return ok(null);
  });
}

export async function deleteComment(commentId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, commentId, async ({ data, supabase }) => {
    const { error } = await supabase.from("comments").delete().eq("id", data);
    if (error) return pgFail(error);
    return ok(null);
  });
}

// ---------------------------------------------------------------- Notifications & views

const markReadSchema = z.object({ ids: z.array(uuidSchema).max(200), read: z.boolean().default(true) });
export async function markNotifications(input: z.input<typeof markReadSchema>): Promise<ActionResult<null>> {
  return withSession(markReadSchema, input, async ({ data, supabase, userId }) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: data.read ? new Date().toISOString() : null })
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) return pgFail(error);
    return ok(null);
  });
}

export async function markAllNotificationsRead(workspaceId: string): Promise<ActionResult<{ count: number }>> {
  return withSession(uuidSchema, workspaceId, async ({ data, supabase }) => {
    const { data: count, error } = await supabase.rpc("mark_all_notifications_read", { p_workspace: data });
    if (error) return pgFail(error);
    return ok({ count: count ?? 0 });
  });
}

const saveViewSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(1).max(40),
  viewType: z.enum(["board", "list", "calendar"]),
  filters: z.record(z.string(), z.string()),
});
export async function saveView(input: z.input<typeof saveViewSchema>): Promise<ActionResult<{ id: string }>> {
  return withSession(saveViewSchema, input, async ({ data, supabase, userId }) => {
    const { data: row, error } = await supabase
      .from("saved_views")
      .insert(clientInsert("saved_views", { project_id: data.projectId, name: data.name, view_type: data.viewType, filters: data.filters, user_id: userId }))
      .select("id")
      .single();
    if (error) return pgFail(error);
    return ok({ id: row.id });
  });
}

export async function deleteView(viewId: string): Promise<ActionResult<null>> {
  return withSession(uuidSchema, viewId, async ({ data, supabase }) => {
    const { error } = await supabase.from("saved_views").delete().eq("id", data);
    if (error) return pgFail(error);
    return ok(null);
  });
}
