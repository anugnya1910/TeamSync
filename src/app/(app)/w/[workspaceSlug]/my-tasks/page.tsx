import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MyTasks } from "@/components/tasks/my-tasks";
import { getMyOpenTasks } from "@/lib/data/my-tasks";
import type { TaskLite } from "@/lib/algorithms/types";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { suggestNext } from "@/lib/intelligence/suggested-next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage({ params }: PageProps<"/w/[workspaceSlug]/my-tasks">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const tasks = await getMyOpenTasks(workspace.id, profile.id);
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");

  // Dependencies touching my tasks + the status of the tasks on the other end (RLS applies).
  const ids = tasks.slice(0, 200).map((t) => t.id);
  const supabase = await createClient();
  const { data: depRows } = ids.length
    ? await supabase.from("task_dependencies").select("blocker_task_id, blocked_task_id").or(`blocker_task_id.in.(${ids.join(",")}),blocked_task_id.in.(${ids.join(",")})`)
    : { data: [] };
  const deps = (depRows ?? []).map((d) => ({ blockerId: d.blocker_task_id, blockedId: d.blocked_task_id }));
  const otherIds = [...new Set(deps.flatMap((d) => [d.blockerId, d.blockedId]))].filter((id) => !ids.includes(id));
  const { data: others } = otherIds.length
    ? await supabase.from("tasks").select("id, status, priority, due_date, is_blocked, parent_task_id").in("id", otherIds).is("deleted_at", null)
    : { data: [] };
  const lite = (t: { id: string; status: TaskLite["status"]; priority: TaskLite["priority"]; due_date: string | null; is_blocked: boolean; parent_task_id: string | null }): TaskLite => ({
    id: t.id, status: t.status, priority: t.priority, dueDate: t.due_date, isBlocked: t.is_blocked, parentTaskId: t.parent_task_id, effort: null, assigneeIds: [],
  });
  const suggestions = suggestNext(tasks.map(lite), (others ?? []).map(lite), deps, today);
  return (
    <>
      <PageHeader title="My Tasks" description="Open tasks assigned to you across projects in this workspace." />
      <MyTasks tasks={tasks} today={today} suggestions={suggestions} />
    </>
  );
}
