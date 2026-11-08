/** Risk detection — spec §G.5 (pure). */
import { consideredTasks, daysBetween, effectivelyBlocked, effort, isOpen } from "./common";
import { longestOpenChain } from "./dependencies";
import { forecastFinish, velocityPerDay } from "./forecast";
import type { CompletionPoint, DepLite, MemberLite, MilestoneLite, Severity, TaskLite } from "./types";
import { computeWorkload } from "./workload";

export type RiskType =
  | "OVERDUE"
  | "DUE_SOON_NOT_STARTED"
  | "STALE"
  | "BLOCKED_HIGH_PRIORITY"
  | "SCHEDULE_CONFLICT"
  | "OWNER_OVERLOADED"
  | "UNASSIGNED_DUE_SOON"
  | "MILESTONE_AT_RISK"
  | "CRITICAL_CHAIN";

export type Risk = {
  type: RiskType;
  severity: Severity;
  taskId?: string;
  milestoneId?: string;
  message: string;
  dueDate?: string | null;
};

export const RISK_LABELS: Record<RiskType, string> = {
  OVERDUE: "Overdue",
  DUE_SOON_NOT_STARTED: "Due soon, not started",
  STALE: "Stale",
  BLOCKED_HIGH_PRIORITY: "Blocked high priority",
  SCHEDULE_CONFLICT: "Schedule conflict",
  OWNER_OVERLOADED: "Owner overloaded",
  UNASSIGNED_DUE_SOON: "Unassigned, due soon",
  MILESTONE_AT_RISK: "Milestone at risk",
  CRITICAL_CHAIN: "Critical chain",
};

export type RiskInput = {
  tasks: TaskLite[];
  deps: DepLite[];
  members: MemberLite[];
  milestones: MilestoneLite[];
  today: string;
  completions: CompletionPoint[];
  historyStart?: string | null;
  /** Local date of each task's latest status change */
  lastStatusChange?: Map<string, string>;
  /** Local date of each task's latest comment */
  lastComment?: Map<string, string>;
};

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function overdueSeverity(t: TaskLite, daysLate: number): Severity {
  if (t.priority === "urgent" || t.priority === "high" || daysLate >= 7) return "high";
  if ((t.priority === "low" || t.priority === "none") && daysLate <= 2) return "low";
  return "medium";
}

/** Remaining effort per milestone (considered open tasks). */
export function milestoneRemaining(tasks: TaskLite[], milestoneId: string): number {
  return consideredTasks(tasks)
    .filter((t) => t.milestoneId === milestoneId && isOpen(t))
    .reduce((s, t) => s + effort(t), 0);
}

export function detectRisks(input: RiskInput): Risk[] {
  const { today } = input;
  const all = input.tasks;
  const byId = new Map(all.map((t) => [t.id, t]));
  const open = consideredTasks(all).filter(isOpen);
  const W = computeWorkload({ tasks: consideredTasks(all), members: input.members, deps: input.deps, today });
  const overloaded = new Set(W.members.filter((m) => m.status === "overloaded").map((m) => m.userId));
  const label = (t: TaskLite) => t.key ?? "A task";
  const risks: Risk[] = [];

  for (const t of open) {
    if (t.dueDate && t.dueDate < today) {
      const late = daysBetween(t.dueDate, today);
      risks.push({ type: "OVERDUE", severity: overdueSeverity(t, late), taskId: t.id, dueDate: t.dueDate, message: `${label(t)} is ${late} day${late === 1 ? "" : "s"} overdue` });
    } else if (t.dueDate && daysBetween(today, t.dueDate) <= 2 && (t.status === "backlog" || t.status === "todo")) {
      risks.push({ type: "DUE_SOON_NOT_STARTED", severity: "high", taskId: t.id, dueDate: t.dueDate, message: `${label(t)} is due ${t.dueDate} and hasn't started` });
    }
    if (t.status === "in_progress") {
      const changed = input.lastStatusChange?.get(t.id);
      const commented = input.lastComment?.get(t.id);
      const quietStatus = changed !== undefined && daysBetween(changed, today) > 7;
      const quietComments = commented === undefined || daysBetween(commented, today) > 7;
      if (quietStatus && quietComments) {
        risks.push({ type: "STALE", severity: "medium", taskId: t.id, dueDate: t.dueDate, message: `${label(t)} has been in progress for over a week without updates` });
      }
    }
    if (effectivelyBlocked(t, input.deps, byId) && (t.priority === "urgent" || t.priority === "high")) {
      risks.push({ type: "BLOCKED_HIGH_PRIORITY", severity: "high", taskId: t.id, dueDate: t.dueDate, message: `${label(t)} (${t.priority}) is blocked` });
    }
    for (const d of input.deps.filter((x) => x.blockedId === t.id)) {
      const b = byId.get(d.blockerId);
      if (b && b.dueDate && t.dueDate && b.dueDate > t.dueDate) {
        risks.push({ type: "SCHEDULE_CONFLICT", severity: "medium", taskId: t.id, dueDate: t.dueDate, message: `${label(b)} is due after ${label(t)}, which it blocks` });
      }
    }
    if (t.assigneeIds.length > 0 && t.assigneeIds.every((a) => overloaded.has(a))) {
      risks.push({ type: "OWNER_OVERLOADED", severity: "medium", taskId: t.id, dueDate: t.dueDate, message: `${label(t)} is owned only by overloaded members` });
    }
    if (t.assigneeIds.length === 0 && t.dueDate && daysBetween(today, t.dueDate) <= 7 && t.dueDate >= today) {
      risks.push({ type: "UNASSIGNED_DUE_SOON", severity: "high", taskId: t.id, dueDate: t.dueDate, message: `${label(t)} is due ${t.dueDate} with no assignee` });
    }
  }

  for (const m of input.milestones) {
    if (m.status !== "open" || !m.dueDate) continue;
    const f = forecastFinish(input.completions, milestoneRemaining(all, m.id), today, input.historyStart);
    if (f && f > m.dueDate) {
      risks.push({ type: "MILESTONE_AT_RISK", severity: "high", milestoneId: m.id, dueDate: m.dueDate, message: `${m.name} is forecast to finish ${f}, after its due date ${m.dueDate}` });
    }
  }

  const chain = longestOpenChain(open, input.deps);
  const v = velocityPerDay(input.completions, today, input.historyStart);
  const end = chain.taskIds.length ? byId.get(chain.taskIds[chain.taskIds.length - 1]!) : undefined;
  if (chain.length >= 3 && end?.dueDate && v && daysBetween(today, end.dueDate) < chain.remainingEffort / v) {
    risks.push({ type: "CRITICAL_CHAIN", severity: "high", taskId: end.id, dueDate: end.dueDate, message: `A chain of ${chain.length} dependent tasks (${chain.remainingEffort} pts) can't finish by ${end.dueDate} at current pace` });
  }

  return risks.sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  );
}
