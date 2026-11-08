import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRole } from "@/lib/domain";
import type { Tables } from "@/types/database";

export type ProjectMember = {
  user_id: string;
  role: ProjectRole;
  weekly_capacity_points: number;
  profile: { id: string; full_name: string; handle: string; avatar_url: string | null };
};

export type ProjectBundle = {
  project: Tables<"projects">;
  myRole: ProjectRole | null;
  members: ProjectMember[];
  milestones: Tables<"milestones">[];
  labels: Tables<"labels">[];
};

/** Project by key within a workspace, with members/milestones/labels — null when not visible (RLS). */
export const getProjectBundle = cache(async (workspaceId: string, key: string): Promise<ProjectBundle | null> => {
  if (!/^[A-Za-z]{2,5}$/.test(key)) return null;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("key", key.toUpperCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return null;

  const [roleRes, membersRes, milestonesRes, labelsRes] = await Promise.all([
    supabase.rpc("project_role_of", { p: project.id }),
    supabase
      .from("project_members")
      .select("user_id, role, weekly_capacity_points, profile:profiles!inner(id, full_name, handle, avatar_url)")
      .eq("project_id", project.id)
      .order("added_at"),
    supabase.from("milestones").select("*").eq("project_id", project.id).order("sort_order").order("due_date", { nullsFirst: false }),
    supabase.from("labels").select("*").eq("project_id", project.id).order("name"),
  ]);

  return {
    project,
    myRole: (roleRes.data as ProjectRole | null) ?? null,
    members: (membersRes.data ?? []) as ProjectMember[],
    milestones: milestonesRes.data ?? [],
    labels: labelsRes.data ?? [],
  };
});

export type ProjectCard = Tables<"projects"> & {
  totalEffort: number;
  doneEffort: number;
  taskCount: number;
  memberIds: { user_id: string; profile: { full_name: string; avatar_url: string | null } }[];
};

/** Visible projects of a workspace with real progress (done effort ÷ total effort, §B.6 rule). */
export async function listProjects(workspaceId: string, opts: { includeArchived?: boolean } = {}): Promise<ProjectCard[]> {
  const supabase = await createClient();
  let q = supabase
    .from("projects")
    .select("*, project_members(user_id, profile:profiles(full_name, avatar_url))")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const { data: projects } = await q;
  if (!projects?.length) return [];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("project_id, status, effort_points, parent_task_id")
    .in("project_id", projects.map((p) => p.id))
    .neq("status", "cancelled");

  const agg = new Map<string, { total: number; done: number; count: number }>();
  for (const t of tasks ?? []) {
    if (t.parent_task_id) continue; // subtasks roll into parents (§G common definitions)
    const a = agg.get(t.project_id) ?? { total: 0, done: 0, count: 0 };
    const e = t.effort_points ?? 1;
    a.total += e;
    a.count += 1;
    if (t.status === "done") a.done += e;
    agg.set(t.project_id, a);
  }

  return projects.map((p) => {
    const a = agg.get(p.id) ?? { total: 0, done: 0, count: 0 };
    const { project_members, ...rest } = p as typeof p & {
      project_members: { user_id: string; profile: { full_name: string; avatar_url: string | null } | null }[];
    };
    return {
      ...(rest as Tables<"projects">),
      totalEffort: a.total,
      doneEffort: a.done,
      taskCount: a.count,
      memberIds: (project_members ?? [])
        .filter((m) => m.profile)
        .map((m) => ({ user_id: m.user_id, profile: m.profile! })),
    };
  });
}

/** Resolves "KEY-n" to a task under RLS. */
export async function getTaskByKey(workspaceId: string, projectKey: string, number: number) {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, key")
    .eq("workspace_id", workspaceId)
    .eq("key", projectKey)
    .is("deleted_at", null)
    .maybeSingle();
  if (!project) return null;
  const { data: task } = await supabase
    .from("tasks")
    .select("id, number, project_id")
    .eq("project_id", project.id)
    .eq("number", number)
    .maybeSingle();
  return task ? { ...task, projectKey: project.key } : null;
}
