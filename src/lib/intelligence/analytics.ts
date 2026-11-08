/**
 * Project analytics datasets (spec §B.18). Pure: takes already-loaded project data and returns
 * plain chart rows, so every number on the analytics page is derived from real rows and is
 * unit-testable against the algorithm fixtures.
 */
import { burndownSeries, cumulativeFlow, cycleTimeDays, MAX_RANGE_DAYS, onTimeRate, throughputByWeek, weekStartOf, type BurndownPoint, type CfdPoint, type ThroughputPoint } from "@/lib/algorithms/analytics";
import { addDaysIso, consideredTasks, daysBetween, effort, isOpen } from "@/lib/algorithms/common";
import { RISK_LABELS, type Risk } from "@/lib/algorithms/risk";
import type { MemberLite, StatusChange, TaskLite } from "@/lib/algorithms/types";
import type { MemberLoad } from "@/lib/algorithms/workload";
import type { TaskPriority } from "@/lib/domain";

export const PERIODS = { "14": 14, "30": 30, "90": 90, all: null } as const;
export type PeriodKey = keyof typeof PERIODS;
export const isPeriodKey = (v: unknown): v is PeriodKey => typeof v === "string" && v in PERIODS;

export type ContributionRow = { userId: string; name: string; effort: number; comments: number; reviews: number };
export type ProjectAnalytics = {
  period: { key: PeriodKey; start: string; end: string; days: number };
  kpis: {
    openTasks: number;
    completedThisWeek: number;
    onTime: { rate: number | null; sample: number };
    cycle: { median: number | null; p85: number | null; sample: number };
  };
  totalTasks: number;
  burndown: BurndownPoint[];
  hasIdeal: boolean;
  throughput: ThroughputPoint[];
  workload: { name: string; load: number; capacity: number }[];
  contributions: ContributionRow[];
  pulseTrend: { date: string; score: number | null }[];
  risks: { type: string; label: string; count: number }[];
  overdueByPriority: { priority: TaskPriority; count: number }[];
  cfd: CfdPoint[];
  cycleHistogram: { bucket: string; tasks: number }[];
};

export type AnalyticsInput = {
  tasks: TaskLite[];
  history: StatusChange[];
  members: MemberLite[];
  workload: MemberLoad[];
  risks: Risk[];
  today: string;
  historyStart: string | null;
  targetDate: string | null;
  /** Comments in the period: author + local date */
  comments: { authorId: string | null; date: string }[];
  /** Reviews: in_review → done transitions with who moved them */
  reviews: { userId: string | null; date: string }[];
  snapshots: { date: string; score: number | null }[];
  period: PeriodKey;
  milestoneId?: string | null;
};

const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];
const CYCLE_BUCKETS: { label: string; max: number }[] = [
  { label: "0–1 d", max: 1 },
  { label: "2–3 d", max: 3 },
  { label: "4–7 d", max: 7 },
  { label: "8–14 d", max: 14 },
  { label: "15+ d", max: Infinity },
];

export function periodRange(key: PeriodKey, today: string, historyStart: string | null): { start: string; end: string; days: number } {
  const n = PERIODS[key];
  const earliest = historyStart && historyStart < today ? historyStart : today;
  let start = n === null ? earliest : addDaysIso(today, -(n - 1));
  if (n !== null && start < earliest) start = earliest;
  if (daysBetween(start, today) + 1 > MAX_RANGE_DAYS) start = addDaysIso(today, -(MAX_RANGE_DAYS - 1));
  return { start, end: today, days: daysBetween(start, today) + 1 };
}

export function buildProjectAnalytics(input: AnalyticsInput): ProjectAnalytics {
  const { today } = input;
  const range = periodRange(input.period, today, input.historyStart);
  const inPeriod = (d: string | null | undefined) => Boolean(d && d >= range.start && d <= range.end);
  const considered = consideredTasks(input.tasks);

  // Burndown/CFD can be narrowed to one milestone; everything else is project-wide.
  const scoped = input.milestoneId ? input.tasks.filter((t) => t.milestoneId === input.milestoneId || (t.parentTaskId && input.tasks.find((p) => p.id === t.parentTaskId)?.milestoneId === input.milestoneId)) : input.tasks;
  const scopedIds = new Set(scoped.map((t) => t.id));
  const scopedHistory = input.history.filter((h) => scopedIds.has(h.taskId));
  const burndown = burndownSeries(scopedHistory, scoped, range, input.milestoneId ? null : input.targetDate);

  const weekStart = weekStartOf(today);
  const completedThisWeek = considered.filter((t) => t.status === "done" && t.completedDate && t.completedDate >= weekStart).length;
  const cycle = cycleTimeDays(input.history.filter((h) => inPeriod(h.date)));

  // Contributions in the period (members only; effort split between assignees).
  const names = new Map(input.members.map((m) => [m.userId, m.name ?? "Member"]));
  const contrib = new Map<string, ContributionRow>();
  const row = (id: string) => {
    let r = contrib.get(id);
    if (!r) contrib.set(id, (r = { userId: id, name: names.get(id) ?? "Member", effort: 0, comments: 0, reviews: 0 }));
    return r;
  };
  for (const t of considered) {
    if (t.status !== "done" || !inPeriod(t.completedDate) || !t.assigneeIds.length) continue;
    const share = effort(t) / t.assigneeIds.length;
    for (const a of t.assigneeIds) if (names.has(a)) row(a).effort += share;
  }
  for (const c of input.comments) if (c.authorId && names.has(c.authorId) && inPeriod(c.date)) row(c.authorId).comments += 1;
  for (const r of input.reviews) if (r.userId && names.has(r.userId) && inPeriod(r.date)) row(r.userId).reviews += 1;
  const contributions = [...contrib.values()]
    .map((r) => ({ ...r, effort: Math.round(r.effort * 10) / 10 }))
    .filter((r) => r.effort + r.comments + r.reviews > 0)
    .sort((a, b) => b.effort + b.comments + b.reviews - (a.effort + a.comments + a.reviews));

  const riskCounts = new Map<string, number>();
  for (const r of input.risks) riskCounts.set(r.type, (riskCounts.get(r.type) ?? 0) + 1);
  const overdue = considered.filter((t) => isOpen(t) && t.dueDate && t.dueDate < today);

  const histogram = CYCLE_BUCKETS.map((b) => ({ bucket: b.label, tasks: 0 }));
  for (const v of cycle.values) {
    const i = CYCLE_BUCKETS.findIndex((b) => v <= b.max);
    histogram[i]!.tasks += 1;
  }

  return {
    period: { key: input.period, ...range },
    kpis: { openTasks: considered.filter(isOpen).length, completedThisWeek, onTime: onTimeRate(considered.filter((t) => inPeriod(t.completedDate))), cycle },
    totalTasks: considered.length,
    burndown,
    hasIdeal: burndown.some((p) => p.ideal !== null),
    throughput: throughputByWeek(input.tasks, 12, today),
    workload: input.workload.map((m) => ({ name: m.name, load: Math.round(m.load * 10) / 10, capacity: m.capacity })),
    contributions,
    pulseTrend: input.snapshots.filter((s) => inPeriod(s.date)),
    risks: [...riskCounts.entries()].map(([type, count]) => ({ type, label: RISK_LABELS[type as keyof typeof RISK_LABELS] ?? type, count })).sort((a, b) => b.count - a.count),
    overdueByPriority: PRIORITY_ORDER.map((p) => ({ priority: p, count: overdue.filter((t) => t.priority === p).length })),
    cfd: cumulativeFlow(scopedHistory, scoped, range),
    cycleHistogram: histogram,
  };
}

// ---------------------------------------------------------------------------------------------
// Workspace roll-up (spec §B.18): health table, throughput across projects, top contributors.

export type WorkspaceProjectRow = { id: string; key: string; name: string; status: string; targetDate: string | null };
export type WorkspaceAnalyticsInput = {
  projects: WorkspaceProjectRow[];
  /** Considered + subtasks; project id carried on each task */
  tasks: (TaskLite & { projectId: string })[];
  /** Latest snapshot per project, and the one closest to 7 days earlier */
  snapshots: { projectId: string; date: string; score: number | null; band: string }[];
  members: { userId: string; name: string; avatarUrl: string | null; showOnLeaderboard: boolean }[];
  me: string;
  today: string;
};
export type HealthRow = {
  projectId: string; key: string; name: string; status: string; score: number | null; band: string | null; delta: number | null;
  openTasks: number; overdue: number; doneLast30: number; targetDate: string | null;
};
export type WorkspaceAnalytics = {
  health: HealthRow[];
  throughputSeries: { key: string; label: string }[];
  throughput: ({ weekStart: string } & Record<string, number | string>)[];
  contributors: { userId: string; name: string; avatarUrl: string | null; effort: number; tasks: number; rank: number | null; isSelf: boolean }[];
  totals: { projects: number; openTasks: number; overdue: number; doneLast30: number };
};

export const OTHER_SERIES = "other";

export function buildWorkspaceAnalytics(input: WorkspaceAnalyticsInput): WorkspaceAnalytics {
  const { today } = input;
  const since30 = addDaysIso(today, -29);
  const byProject = new Map<string, TaskLite[]>();
  for (const t of input.tasks) byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);

  const health: HealthRow[] = input.projects.map((p) => {
    const considered = consideredTasks(byProject.get(p.id) ?? []);
    const snaps = input.snapshots.filter((s) => s.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const latest = snaps[0];
    const weekAgo = snaps.find((s) => s.date <= addDaysIso(today, -7) && s.score !== null);
    return {
      projectId: p.id,
      key: p.key,
      name: p.name,
      status: p.status,
      score: latest?.score ?? null,
      band: latest?.band ?? null,
      delta: latest?.score != null && weekAgo?.score != null ? latest.score - weekAgo.score : null,
      openTasks: considered.filter(isOpen).length,
      overdue: considered.filter((t) => isOpen(t) && t.dueDate && t.dueDate < today).length,
      doneLast30: considered.filter((t) => t.status === "done" && t.completedDate && t.completedDate >= since30).length,
      targetDate: p.targetDate,
    };
  });

  // Throughput: top 4 projects by completions in the window get their own series, the rest fold into "Other".
  const weeks = throughputByWeek([], 12, today).map((w) => w.weekStart);
  const first = weeks[0]!;
  const doneInWindow = input.tasks.filter((t) => t.status === "done" && t.completedDate && t.completedDate >= first);
  const doneConsidered = new Set(consideredTasks(input.tasks).map((t) => t.id));
  const counts = new Map<string, number>();
  for (const t of doneInWindow) if (doneConsidered.has(t.id)) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const top = ranked.slice(0, 4);
  const keyOf = new Map(input.projects.map((p) => [p.id, p.key]));
  const throughputSeries = [
    ...top.map((id) => ({ key: id, label: keyOf.get(id) ?? "Project" })),
    ...(ranked.length > 4 ? [{ key: OTHER_SERIES, label: "Other" }] : []),
  ];
  const throughput = weeks.map((w) => {
    const row: { weekStart: string } & Record<string, number | string> = { weekStart: w };
    for (const s of throughputSeries) row[s.key] = 0;
    return row;
  });
  const idx = new Map(weeks.map((w, i) => [w, i]));
  for (const t of doneInWindow) {
    if (!doneConsidered.has(t.id)) continue;
    const i = idx.get(weekStartOf(t.completedDate!));
    if (i === undefined) continue;
    const k = top.includes(t.projectId) ? t.projectId : OTHER_SERIES;
    throughput[i]![k] = (Number(throughput[i]![k]) || 0) + 1;
  }

  // Top contributors: completed effort in the last 30 days (shared between assignees). Opted-out
  // members are not ranked, but the viewer always sees their own row.
  const effortBy = new Map<string, { effort: number; tasks: number }>();
  for (const t of consideredTasks(input.tasks)) {
    if (t.status !== "done" || !t.completedDate || t.completedDate < since30 || !t.assigneeIds.length) continue;
    for (const a of t.assigneeIds) {
      const cur = effortBy.get(a) ?? { effort: 0, tasks: 0 };
      cur.effort += effort(t) / t.assigneeIds.length;
      cur.tasks += 1;
      effortBy.set(a, cur);
    }
  }
  const rows = input.members
    .map((m) => ({ ...m, effort: Math.round((effortBy.get(m.userId)?.effort ?? 0) * 10) / 10, tasks: effortBy.get(m.userId)?.tasks ?? 0 }))
    .filter((m) => m.effort > 0 || m.userId === input.me);
  const rankable = rows.filter((r) => r.showOnLeaderboard && r.effort > 0).sort((a, b) => b.effort - a.effort);
  const contributors: WorkspaceAnalytics["contributors"] = rankable.slice(0, 10).map((r, i) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, effort: r.effort, tasks: r.tasks, rank: i + 1, isSelf: r.userId === input.me }));
  if (!contributors.some((c) => c.isSelf)) {
    const self = rows.find((r) => r.userId === input.me);
    if (self) {
      const pos = rankable.findIndex((r) => r.userId === input.me);
      contributors.push({ userId: self.userId, name: self.name, avatarUrl: self.avatarUrl, effort: self.effort, tasks: self.tasks, rank: pos >= 0 ? pos + 1 : null, isSelf: true });
    }
  }

  return {
    health,
    throughputSeries,
    throughput,
    contributors,
    totals: {
      projects: health.length,
      openTasks: health.reduce((s, h) => s + h.openTasks, 0),
      overdue: health.reduce((s, h) => s + h.overdue, 0),
      doneLast30: health.reduce((s, h) => s + h.doneLast30, 0),
    },
  };
}
