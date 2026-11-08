import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/lib/domain";

export type MyTask = {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_blocked: boolean;
  parent_task_id: string | null;
  project: { id: string; key: string; name: string; color: string };
  canEdit: boolean;
};

/** Open tasks assigned to the user across projects they can see in a workspace (RLS applies). */
export async function getMyOpenTasks(workspaceId: string, userId: string): Promise<MyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_assignees")
    .select("task:tasks!inner(id, number, title, status, priority, due_date, is_blocked, parent_task_id, project:projects!inner(id, key, name, color, status))")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  type Row = { task: { id: string; number: number; title: string; status: TaskStatus; priority: TaskPriority; due_date: string | null; is_blocked: boolean; parent_task_id: string | null; project: { id: string; key: string; name: string; color: string; status: string } } };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => r.task).filter((t) => t.status !== "done" && t.status !== "cancelled");
  return rows.map((t) => ({ ...t, canEdit: t.project.status !== "archived" }));
}
