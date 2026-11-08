/** Project Pulse — spec §G.1, implemented as written (pure). */
import { clamp, consideredTasks, daysBetween, effectivelyBlocked, effort, isOpen, pct, PRIORITY_WEIGHT } from "./common";
import { forecastFinish } from "./forecast";
import { milestoneRemaining } from "./risk";
import type { CompletionPoint, DepLite, MemberLite, MilestoneLite, ProjectLite, TaskLite } from "./types";
import { computeWorkload } from "./workload";

export type PulseBand = "healthy" | "watch" | "at_risk" | "critical" | "insufficient_data";
export type FactorKey = "schedule" | "overdue" | "deadline" | "blocked" | "workload";

export type PulseFactor = {
  key: FactorKey;
  label: string;
  weight: number;
  subScore: number;
  points: number;
  lostPoints: number;
  note: string;
};

export type PulseAction = { label: string; href: string };

export type PulseResult = {
  score: number | null;
  band: PulseBand;
  factors: PulseFactor[];
  reasons: string[];
  actions: PulseAction[];
  infos: string[];
  stats: {
    totalEffort: number;
    doneEffort: number;
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    remainingEffort: number;
  };
};

export type PulseInput = {
  project: ProjectLite;
  tasks: TaskLite[];
  members: MemberLite[];
  deps: DepLite[];
  milestones: MilestoneLite[];
  today: string;
  completions?: CompletionPoint[];
  historyStart?: string | null;
};

export const PULSE_WEIGHTS: Record<FactorKey, number> = { schedule: 30, overdue: 25, deadline: 20, blocked: 15, workload: 10 };
export const FACTOR_LABELS: Record<FactorKey, string> = {
  schedule: "Completion vs schedule",
  overdue: "Overdue pressure",
  deadline: "Deadline readiness",
  blocked: "Blocked work",
  workload: "Workload balance",
};

export function bandFor(score: number): Exclude<PulseBand, "insufficient_data"> {
  return score >= 80 ? "healthy" : score >= 60 ? "watch" : score >= 40 ? "at_risk" : "critical";
}

export function computePulse(input: PulseInput): PulseResult {
  const { today, project } = input;
  const T = consideredTasks(input.tasks);
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const totalEffort = T.reduce((s, t) => s + effort(t), 0);
  const doneEffort = T.filter((t) => t.status === "done").reduce((s, t) => s + effort(t), 0);
  const openTasks = T.filter(isOpen);
  const overdue = openTasks.filter((t) => t.dueDate !== null && t.dueDate < today);
  const blocked = openTasks.filter((t) => effectivelyBlocked(t, input.deps, byId));
  const stats = {
    totalEffort,
    doneEffort,
    openTasks: openTasks.length,
    overdueTasks: overdue.length,
    blockedTasks: blocked.length,
    remainingEffort: totalEffort - doneEffort,
  };

  if (T.length < 3) {
    return { score: null, band: "insufficient_data", factors: [], reasons: ["Add at least 3 tasks"], actions: [], infos: [], stats };
  }

  // F1 Completion vs schedule (30)
  const completion = totalEffort > 0 ? doneEffort / totalEffort : 0;
  let f1: number;
  let f1Note: string;
  if (project.startDate && project.targetDate && project.targetDate > project.startDate) {
    const elapsed = clamp(daysBetween(project.startDate, today) / daysBetween(project.startDate, project.targetDate), 0, 1);
    const expected = Math.max(elapsed, 0.05);
    f1 = clamp(completion / expected, 0, 1);
    f1Note = `${pct(completion)} done vs ${pct(elapsed)} of timeline elapsed`;
  } else {
    f1 = completion;
    f1Note = `${pct(completion)} of effort done (no timeline set)`;
  }
  if (project.targetDate && today > project.targetDate && completion < 1) {
    f1 = Math.min(f1, 0.3);
    f1Note += " · past the target date";
  }

  // F2 Overdue pressure (25)
  let f2 = 1;
  if (openTasks.length > 0) {
    const overdueWeight = overdue.reduce((s, t) => {
      const ageFactor = 1 + Math.min(daysBetween(t.dueDate!, today) / 7, 2) * 0.5;
      return s + effort(t) * PRIORITY_WEIGHT[t.priority] * ageFactor;
    }, 0);
    const openWeight = openTasks.reduce((s, t) => s + effort(t) * PRIORITY_WEIGHT[t.priority], 0);
    f2 = 1 - clamp(openWeight > 0 ? overdueWeight / openWeight : 0, 0, 1);
  }
  const f2Note = overdue.length ? `${overdue.length} open task${overdue.length === 1 ? " is" : "s are"} overdue` : "Nothing overdue";

  // F3 Deadline proximity readiness (20)
  const soon = openTasks.filter((t) => t.dueDate !== null && daysBetween(today, t.dueDate) >= 0 && daysBetween(today, t.dueDate) <= 3);
  let f3 = 1;
  let f3Note = "No open work due in the next 3 days";
  let atRiskMilestones = 0;
  if (soon.length > 0) {
    const notStarted = soon.filter((t) => t.status === "backlog" || t.status === "todo");
    const soonEffort = soon.reduce((s, t) => s + effort(t), 0);
    f3 = 1 - notStarted.reduce((s, t) => s + effort(t), 0) / soonEffort;
    for (const m of input.milestones) {
      if (m.status !== "open" || !m.dueDate) continue;
      const f = forecastFinish(input.completions ?? [], milestoneRemaining(input.tasks, m.id), today, input.historyStart);
      if (f && f > m.dueDate) {
        f3 -= 0.1;
        atRiskMilestones++;
      }
    }
    f3 = clamp(f3, 0, 1);
    f3Note = `${notStarted.length} of ${soon.length} task${soon.length === 1 ? "" : "s"} due within 3 days not started`;
    if (atRiskMilestones) f3Note += ` · ${atRiskMilestones} milestone${atRiskMilestones === 1 ? "" : "s"} forecast late`;
  }

  // F4 Blocked work (15)
  let f4 = 1;
  if (openTasks.length > 0) {
    const openEffort = openTasks.reduce((s, t) => s + effort(t), 0);
    f4 = 1 - blocked.reduce((s, t) => s + effort(t), 0) / openEffort;
  }
  const urgentBlocked = blocked.some((t) => t.priority === "urgent");
  if (urgentBlocked) f4 = Math.min(f4, 0.6);
  const f4Note = blocked.length ? `${blocked.length} open task${blocked.length === 1 ? " is" : "s are"} blocked${urgentBlocked ? " (incl. urgent)" : ""}` : "Nothing blocked";

  // F5 Workload balance (10)
  const W = computeWorkload({ tasks: openTasks, members: input.members, deps: input.deps, today });
  let f5 = W.activeMembers < 2 ? 1 : 1 - W.imbalanceIndex;
  if (W.overloadedCount > 0) f5 = Math.min(f5, 0.7);
  const f5Note =
    W.activeMembers < 2
      ? "Fewer than 2 active members — balance not assessed"
      : `Imbalance index ${W.imbalanceIndex.toFixed(2)}${W.overloadedCount ? ` · ${W.overloadedCount} overloaded` : ""}`;

  const sub: Record<FactorKey, number> = { schedule: f1, overdue: f2, deadline: f3, blocked: f4, workload: f5 };
  const notes: Record<FactorKey, string> = { schedule: f1Note, overdue: f2Note, deadline: f3Note, blocked: f4Note, workload: f5Note };
  const factors: PulseFactor[] = (Object.keys(PULSE_WEIGHTS) as FactorKey[]).map((key) => ({
    key,
    label: FACTOR_LABELS[key],
    weight: PULSE_WEIGHTS[key],
    subScore: sub[key],
    points: PULSE_WEIGHTS[key] * sub[key],
    lostPoints: PULSE_WEIGHTS[key] * (1 - sub[key]),
    note: notes[key],
  }));
  const score = Math.round(factors.reduce((s, f) => s + f.points, 0));

  const reasons = [...factors]
    .filter((f) => f.lostPoints >= 2)
    .sort((a, b) => b.lostPoints - a.lostPoints)
    .slice(0, 3)
    .map((f) => `${f.label}: ${f.note} (−${f.lostPoints.toFixed(1)} pts)`);

  const actions: PulseAction[] = [];
  if (f2 < 0.9 && overdue.length) actions.push({ label: `Review ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"}`, href: "list?due=overdue" });
  if (f4 < 0.9 && blocked.length) actions.push({ label: `Unblock ${blocked.length} task${blocked.length === 1 ? "" : "s"}`, href: "list?blocked=true" });
  if (f3 < 0.9 && soon.length) actions.push({ label: "Start work due this week", href: "list?due=week&status=backlog,todo" });
  if (f5 < 0.9 && W.activeMembers >= 2) actions.push({ label: "Rebalance workload", href: "workload" });
  if (f1 < 0.6) actions.push({ label: "Check the plan against the target date", href: "calendar" });

  const infos: string[] = [];
  if (T.every((t) => t.dueDate === null)) infos.push("No due dates set — Pulse can't assess deadlines");
  if (W.unassignedOpenEffort > 0) infos.push(`${W.unassignedOpenEffort} pts of open work unassigned`);

  return { score, band: bandFor(score), factors, reasons, actions, infos, stats };
}
