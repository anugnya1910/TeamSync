import type { Recommendation } from "@/lib/algorithms/workload";

/** Shape expected by save_workload_recommendations(p_items jsonb). */
export function recommendationRows(recs: Recommendation[]) {
  return recs.map((r) => ({
    task_id: r.taskId,
    from_user_id: r.fromUserId,
    to_user_id: r.toUserId,
    reason: r.reason,
    imbalance_before: Math.round(r.imbalanceBefore * 1000) / 1000,
    imbalance_after: Math.round(r.imbalanceAfter * 1000) / 1000,
    details: {
      task_key: r.taskKey,
      task_title: r.taskTitle,
      from_before: r.fromBefore,
      from_after: r.fromAfter,
      to_before: r.toBefore,
      to_after: r.toAfter,
      gain: r.gain,
    },
  }));
}
