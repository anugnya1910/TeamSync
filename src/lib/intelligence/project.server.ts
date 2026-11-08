import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consideredTasks, effort, isOpen } from "@/lib/algorithms/common";
import { forecastFinish } from "@/lib/algorithms/forecast";
import { computePulse, type PulseResult } from "@/lib/algorithms/pulse";
import { detectRisks, milestoneRemaining, type Risk } from "@/lib/algorithms/risk";
import type { CompletionPoint, DepLite, MemberLite, MilestoneLite, StatusChange, TaskLite } from "@/lib/algorithms/types";
import { computeWorkload, recommendReassignments, type Recommendation, type WorkloadResult } from "@/lib/algorithms/workload";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ProjectData = {
  project: Tables<"projects">;
  tasks: TaskLite[];
  deps: DepLite[];
  members: MemberLite[];
  milestones: MilestoneLite[];
  history: StatusChange[];
  completions: CompletionPoint[];
  lastComment: Map<string, string>;
  lastStatusChange: Map<string, string>;
  today: string;
  tz: string;
  historyStart: string | null;
};

const localDate = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd");

/** Loads everything the algorithms need for one project (RLS applies to the given client). */
export async function loadProjectData(client: Client, projectId: string, tz: string): Promise<ProjectData | null> {
  const { data: project } = await client.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const [tasksRes, depsRes, membersRes, msRes, histRes, commentsRes] = await Promise.all([
    client
      .from("tasks")
      .select("id, number, title, parent_task_id, status, priority, effort_points, due_date, start_date, is_blocked, milestone_id, created_at, completed_at, created_by, assignees:task_assignees(user_id)")
      .eq("project_id", projectId)
      .is("deleted_at", null),
    client.from("task_dependencies").select("blocker_task_id, blocked_task_id").eq("project_id", projectId),
    client.from("project_members").select("user_id, role, weekly_capacity_points, profile:profiles!inner(full_name)").eq("project_id", projectId),
    client.from("milestones").select("id, name, due_date, status").eq("project_id", projectId),
    client.from("task_status_history").select("task_id, from_status, to_status, effort_points, changed_at").eq("project_id", projectId).order("changed_at").limit(20000),
    client.from("comments").select("task_id, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(5000),
  ]);

  type RawTask = {
    id: string; number: number; title: string; parent_task_id: string | null; status: TaskLite["status"]; priority: TaskLite["priority"];
    effort_points: number | null; due_date: string | null; start_date: string | null; is_blocked: boolean; milestone_id: string | null;
    created_at: string; completed_at: string | null; created_by: string | null; assignees: { user_id: string }[];
  };
  const tasks: TaskLite[] = ((tasksRes.data ?? []) as unknown as RawTask[]).map((t) => ({
    id: t.id,
    key: `${project.key}-${t.number}`,
    title: t.title,
    parentTaskId: t.parent_task_id,
    status: t.status,
    priority: t.priority,
    effort: t.effort_points,
    dueDate: t.due_date,
    startDate: t.start_date,
    isBlocked: t.is_blocked,
    assigneeIds: (t.assignees ?? []).map((a) => a.user_id),
    milestoneId: t.milestone_id,
    createdDate: localDate(t.created_at, tz),
    completedDate: t.completed_at ? localDate(t.completed_at, tz) : null,
    createdBy: t.created_by,
  }));
  const history: StatusChange[] = (histRes.data ?? []).map((h) => ({
    taskId: h.task_id,
    fromStatus: h.from_status,
    toStatus: h.to_status,
    date: localDate(h.changed_at, tz),
    at: h.changed_at,
    effort: h.effort_points,
  }));
  const lastStatusChange = new Map<string, string>();
  for (const h of history) lastStatusChange.set(h.taskId, h.date);
  const lastComment = new Map<string, string>();
  for (const c of commentsRes.data ?? []) if (!lastComment.has(c.task_id)) lastComment.set(c.task_id, localDate(c.created_at, tz));

  const considered = new Set(consideredTasks(tasks).map((t) => t.id));
  const completions: CompletionPoint[] = tasks
    .filter((t) => considered.has(t.id) && t.status === "done" && t.completedDate)
    .map((t) => ({ date: t.completedDate!, effort: effort(t) }));
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const historyStart = project.start_date ?? (tasks.map((t) => t.createdDate!).sort()[0] ?? null);

  return {
    project,
    tasks,
    deps: (depsRes.data ?? []).map((d) => ({ blockerId: d.blocker_task_id, blockedId: d.blocked_task_id })),
    members: (membersRes.data ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      capacity: m.weekly_capacity_points,
      name: (m.profile as { full_name: string }).full_name,
    })),
    milestones: (msRes.data ?? []).map((m) => ({ id: m.id, name: m.name, dueDate: m.due_date, status: m.status })),
    history,
    completions,
    lastComment,
    lastStatusChange,
    today,
    tz,
    historyStart,
  };
}

export type ProjectIntel = {
  data: ProjectData;
  pulse: PulseResult;
  workload: WorkloadResult;
  suggestions: Recommendation[];
  risks: Risk[];
  milestoneForecasts: Record<string, { forecast: string | null; remaining: number; late: boolean | null }>;
};

export function analyse(data: ProjectData, recentlyHandled?: Set<string>): ProjectIntel {
  const common = { tasks: data.tasks, deps: data.deps, members: data.members, milestones: data.milestones, today: data.today };
  const pulse = computePulse({
    project: { startDate: data.project.start_date, targetDate: data.project.target_date },
    ...common,
    completions: data.completions,
    historyStart: data.historyStart,
  });
  const open = consideredTasks(data.tasks).filter(isOpen);
  const workload = computeWorkload({ tasks: open, members: data.members, deps: data.deps, today: data.today });
  const suggestions = recommendReassignments({ tasks: open, members: data.members, deps: data.deps, today: data.today }, { recentlyHandled });
  const risks = detectRisks({ ...common, completions: data.completions, historyStart: data.historyStart, lastComment: data.lastComment, lastStatusChange: data.lastStatusChange });
  const milestoneForecasts: ProjectIntel["milestoneForecasts"] = {};
  for (const m of data.milestones) {
    const remaining = milestoneRemaining(data.tasks, m.id);
    const forecast = m.status === "open" ? forecastFinish(data.completions, remaining, data.today, data.historyStart) : null;
    milestoneForecasts[m.id] = { forecast, remaining, late: forecast && m.dueDate ? forecast > m.dueDate : null };
  }
  return { data, pulse, workload, suggestions, risks, milestoneForecasts };
}

/** Tasks recommended or dismissed in the last 7 days (excluded from new suggestions, §G.2). */
export async function recentlyHandledTasks(client: Client, projectId: string): Promise<Set<string>> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await client
    .from("workload_recommendations")
    .select("task_id, status")
    .eq("project_id", projectId)
    .in("status", ["dismissed", "applied"])
    .gte("created_at", since);
  return new Set((data ?? []).map((r) => r.task_id));
}

export function snapshotPayload(p: PulseResult) {
  return {
    p_score: p.score,
    p_band: p.band,
    p_factors: p.factors.map((f) => ({ key: f.key, label: f.label, weight: f.weight, subScore: Math.round(f.subScore * 1000) / 1000, points: Math.round(f.points * 100) / 100, note: f.note })),
    p_stats: {
      open_tasks: p.stats.openTasks,
      overdue_tasks: p.stats.overdueTasks,
      blocked_tasks: p.stats.blockedTasks,
      remaining_effort: p.stats.remainingEffort,
      completed_effort: p.stats.doneEffort,
    },
  };
}

/** Session-scoped intel for a project + lazy snapshot when today's is missing (spec §B.19). */
export const getProjectIntel = cache(async (projectId: string, tz: string): Promise<ProjectIntel | null> => {
  const supabase = await createClient();
  const data = await loadProjectData(supabase, projectId, tz);
  if (!data) return null;
  const intel = analyse(data, await recentlyHandledTasks(supabase, projectId));
  const { data: existing } = await supabase
    .from("project_health_snapshots")
    .select("id")
    .eq("project_id", projectId)
    .eq("snapshot_date", data.today)
    .maybeSingle();
  if (!existing && data.project.status !== "archived") {
    const p = snapshotPayload(intel.pulse);
    // score is NULL for insufficient data (the generated Args type can't express a nullable smallint).
    await supabase.rpc("upsert_health_snapshot", { p_project: projectId, p_date: data.today, ...p, p_score: p.p_score as number, p_stats: p.p_stats });
  }
  return intel;
});
