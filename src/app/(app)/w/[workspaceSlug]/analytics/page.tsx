import { formatInTimeZone } from "date-fns-tz";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceAnalyticsView } from "@/components/analytics/workspace-analytics";
import { PageHeader } from "@/components/layout/page-header";
import { addDaysIso } from "@/lib/algorithms/common";
import type { TaskLite } from "@/lib/algorithms/types";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { buildWorkspaceAnalytics } from "@/lib/intelligence/analytics";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: PageProps<"/w/[workspaceSlug]/analytics">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const tz = profile.timezone;
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const local = (iso: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd");

  const supabase = await createClient();
  // RLS limits every query to projects the viewer can see.
  const [projectsRes, tasksRes, snapsRes, membersRes] = await Promise.all([
    supabase.from("projects").select("id, key, name, status, target_date").eq("workspace_id", workspace.id).neq("status", "archived").order("name"),
    supabase
      .from("tasks")
      .select("id, project_id, parent_task_id, status, priority, effort_points, due_date, is_blocked, completed_at, created_at, assignees:task_assignees(user_id)")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .limit(20000),
    supabase.from("project_health_snapshots").select("project_id, snapshot_date, score, band").eq("workspace_id", workspace.id).gte("snapshot_date", addDaysIso(today, -14)),
    supabase.from("workspace_members").select("user_id, profile:profiles!inner(full_name, avatar_url, show_on_leaderboard)").eq("workspace_id", workspace.id),
  ]);

  type RawTask = {
    id: string; project_id: string; parent_task_id: string | null; status: TaskLite["status"]; priority: TaskLite["priority"]; effort_points: number | null;
    due_date: string | null; is_blocked: boolean; completed_at: string | null; created_at: string; assignees: { user_id: string }[];
  };
  const projectIds = new Set((projectsRes.data ?? []).map((p) => p.id));
  const tasks = ((tasksRes.data ?? []) as unknown as RawTask[])
    .filter((t) => projectIds.has(t.project_id))
    .map((t) => ({
      id: t.id,
      projectId: t.project_id,
      parentTaskId: t.parent_task_id,
      status: t.status,
      priority: t.priority,
      effort: t.effort_points,
      dueDate: t.due_date,
      isBlocked: t.is_blocked,
      assigneeIds: (t.assignees ?? []).map((a) => a.user_id),
      createdDate: local(t.created_at),
      completedDate: t.completed_at ? local(t.completed_at) : null,
    }));

  const analytics = buildWorkspaceAnalytics({
    projects: (projectsRes.data ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name, status: p.status, targetDate: p.target_date })),
    tasks,
    snapshots: (snapsRes.data ?? []).map((s) => ({ projectId: s.project_id, date: s.snapshot_date, score: s.score, band: s.band })),
    members: (membersRes.data ?? []).map((m) => {
      const p = m.profile as { full_name: string; avatar_url: string | null; show_on_leaderboard: boolean };
      return { userId: m.user_id, name: p.full_name, avatarUrl: p.avatar_url, showOnLeaderboard: p.show_on_leaderboard };
    }),
    me: profile.id,
    today,
  });

  return (
    <>
      <PageHeader title="Analytics" description="Across the projects you can see in this workspace. Pulse scores come from each project's latest daily snapshot." />
      <WorkspaceAnalyticsView analytics={analytics} slug={workspace.slug} />
    </>
  );
}
