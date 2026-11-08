"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { moveTask } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import type { BlockedState } from "@/components/tasks/blocked-dialog";
import type { TaskStatus } from "@/lib/domain";
import { qk } from "@/lib/query-keys";
import { positionBetween } from "@/lib/utils/fractional-index";
import { newMutationId, type BoardTask } from "./use-project-tasks";

/** Optimistic move (status + position) via the `move_task` RPC, with blocked-rule handling. */
export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  const [blocked, setBlocked] = useState<BlockedState>(null);
  type MoveFn = (taskId: string, status: TaskStatus, before: number | null, after: number | null, overrideReason?: string) => Promise<boolean>;
  const selfRef = useRef<MoveFn | null>(null);

  const move = useCallback(
    async (taskId: string, status: TaskStatus, before: number | null, after: number | null, overrideReason?: string) => {
      const key = qk.projectTasks(projectId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardTask[]>(key);
      const optimistic = positionBetween(before, after);
      qc.setQueryData<BoardTask[]>(key, (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status, position: optimistic } : t)),
      );
      const res = await moveTask({ taskId, status, before, after, overrideReason: overrideReason ?? null, clientMutationId: newMutationId() });
      if (!res.ok) {
        if (prev) qc.setQueryData(key, prev);
        if (res.error.code === "TASK_BLOCKED" || res.error.code === "SUBTASKS_OPEN") {
          setBlocked({
            code: res.error.code,
            message: res.error.message,
            retry: (reason) => {
              setBlocked(null);
              void selfRef.current?.(taskId, status, before, after, reason);
            },
          });
        } else {
          toast.error(res.error.message);
        }
        return false;
      }
      qc.setQueryData<BoardTask[]>(key, (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: res.data.status, position: Number(res.data.position), completed_at: res.data.completed_at } : t)),
      );
      void qc.invalidateQueries({ queryKey: qk.task(taskId) });
      if (overrideReason) toast.success("Completed with override");
      return true;
    },
    [projectId, qc],
  );
  useEffect(() => {
    selfRef.current = move;
  }, [move]);

  return { move, blocked, clearBlocked: () => setBlocked(null) };
}
