"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DepLite } from "@/lib/algorithms/types";

export const depsKey = (projectId: string) => ["deps", projectId] as const;

export function useProjectDeps(projectId: string) {
  return useQuery({
    queryKey: depsKey(projectId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("task_dependencies")
        .select("id, blocker_task_id, blocked_task_id")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, blockerId: d.blocker_task_id, blockedId: d.blocked_task_id })) as (DepLite & { id: string })[];
    },
  });
}

/** Ids of open tasks that block `taskId` (status not done/cancelled). */
export function openBlockersOf(taskId: string, deps: DepLite[], statusById: Map<string, string>): string[] {
  return deps
    .filter((d) => d.blockedId === taskId)
    .map((d) => d.blockerId)
    .filter((id) => {
      const s = statusById.get(id);
      return s !== undefined && s !== "done" && s !== "cancelled";
    });
}
