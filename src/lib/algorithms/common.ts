/** Shared definitions used identically by every algorithm (spec §G "Common definitions"). */
import type { TaskPriority } from "@/lib/domain";
import type { DepLite, TaskLite } from "./types";

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.75,
  none: 0.75,
};

export const effort = (t: Pick<TaskLite, "effort">): number => t.effort ?? 1;
export const isOpen = (t: Pick<TaskLite, "status">): boolean => t.status !== "done" && t.status !== "cancelled";
export const clamp = (n: number, lo: number, hi: number): number => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

const DAY = 86_400_000;
const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
/** Whole days from `a` to `b` (b − a) for ISO dates. */
export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / DAY);
export const addDaysIso = (iso: string, n: number): string => new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (iso: string): number => new Date(toUtc(iso)).getUTCDay();

/**
 * Tasks that count for metrics: not cancelled; subtasks roll into their parent — unless the parent
 * has no effort set, in which case its subtasks count individually and the parent is excluded.
 */
export function consideredTasks(tasks: TaskLite[]): TaskLite[] {
  const live = tasks.filter((t) => t.status !== "cancelled");
  const byId = new Map(live.map((t) => [t.id, t]));
  const childrenOf = new Map<string, TaskLite[]>();
  for (const t of live) {
    if (t.parentTaskId && byId.has(t.parentTaskId)) {
      childrenOf.set(t.parentTaskId, [...(childrenOf.get(t.parentTaskId) ?? []), t]);
    }
  }
  const out: TaskLite[] = [];
  for (const t of live) {
    if (t.parentTaskId && byId.has(t.parentTaskId)) {
      const parent = byId.get(t.parentTaskId)!;
      if (parent.effort === null) out.push(t); // parent without effort → subtasks count
      continue;
    }
    const kids = childrenOf.get(t.id) ?? [];
    if (t.effort === null && kids.length > 0) continue; // excluded in favour of its subtasks
    out.push(t);
  }
  return out;
}

/** Manual flag OR at least one blocker that is not done/cancelled (spec §B.7, §G.6). */
export function effectivelyBlocked(task: TaskLite, deps: DepLite[], byId: Map<string, TaskLite>): boolean {
  if (task.isBlocked) return true;
  return deps.some((d) => {
    if (d.blockedId !== task.id) return false;
    const b = byId.get(d.blockerId);
    return b !== undefined && isOpen(b);
  });
}

/** Number of open tasks this task blocks. */
export function openBlockedBy(taskId: string, deps: DepLite[], byId: Map<string, TaskLite>): number {
  return deps.filter((d) => d.blockerId === taskId && byId.has(d.blockedId) && isOpen(byId.get(d.blockedId)!)).length;
}

export const pct = (n: number) => `${Math.round(clamp(n, 0, 1) * 100)}%`;
