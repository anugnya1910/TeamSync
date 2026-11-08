"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { qk } from "@/lib/query-keys";
import { mapPgError } from "@/lib/action-result";
import type { Tables, TablesUpdate } from "@/types/database";

export type BoardTask = Tables<"tasks"> & {
  assigneeIds: string[];
  labelIds: string[];
  commentCount: number;
};

type RawTask = Tables<"tasks"> & {
  assignees: { user_id: string }[];
  labels: { label_id: string }[];
  comments: { count: number }[];
};

const SELECT = "*, assignees:task_assignees(user_id), labels:task_labels(label_id), comments(count)";

export function normaliseTask(t: RawTask): BoardTask {
  const { assignees, labels, comments, ...rest } = t;
  return {
    ...rest,
    assigneeIds: (assignees ?? []).map((a) => a.user_id),
    labelIds: (labels ?? []).map((l) => l.label_id),
    commentCount: comments?.[0]?.count ?? 0,
  };
}

export async function fetchProjectTasks(projectId: string): Promise<BoardTask[]> {
  const { data, error } = await createClient()
    .from("tasks")
    .select(SELECT)
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawTask[]).map(normaliseTask);
}

export function useProjectTasks(projectId: string, initial?: BoardTask[]) {
  return useQuery({
    queryKey: qk.projectTasks(projectId),
    queryFn: () => fetchProjectTasks(projectId),
    initialData: initial,
    staleTime: 15_000,
  });
}

/** Optimistic single-task field update under RLS with rollback + toast (spec §F.7). */
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"tasks"> }) => {
      const { error } = await createClient().from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.projectTasks(projectId) });
      const prev = qc.getQueryData<BoardTask[]>(qk.projectTasks(projectId));
      qc.setQueryData<BoardTask[]>(qk.projectTasks(projectId), (old) =>
        old?.map((t) => (t.id === id ? ({ ...t, ...patch } as BoardTask) : t)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.projectTasks(projectId), ctx.prev);
      toast.error(mapPgError(err as { code?: string; message?: string }).message);
    },
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      void qc.invalidateQueries({ queryKey: qk.task(id) });
    },
  });
}

/** Ids of local mutations still in flight (to ignore our own realtime echoes, spec §C.6). */
export const pendingMutationIds = new Set<string>();

export function newMutationId(): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());
  pendingMutationIds.add(id);
  window.setTimeout(() => pendingMutationIds.delete(id), 10_000);
  return id;
}
