import { describe, expect, it } from "vitest";
import type { MemberLite, StatusChange, TaskLite } from "@/lib/algorithms/types";
import { buildProjectAnalytics, buildWorkspaceAnalytics, isPeriodKey, OTHER_SERIES, periodRange, type AnalyticsInput } from "@/lib/intelligence/analytics";
import { recommendationRows } from "@/lib/intelligence/recommendations";

const TODAY = "2026-11-08"; // Sunday; ISO week starts Mon 2026-11-02

const t = (id: string, o: Partial<TaskLite> = {}): TaskLite => ({
  id,
  parentTaskId: null,
  status: "todo",
  priority: "medium",
  effort: 2,
  dueDate: null,
  isBlocked: false,
  assigneeIds: [],
  createdDate: "2026-11-01",
  completedDate: null,
  ...o,
});

const members: MemberLite[] = [
  { userId: "u1", role: "lead", capacity: 20, name: "Ada Lovelace" },
  { userId: "u2", role: "contributor", capacity: 20, name: "Alan Turing" },
];

function input(o: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return {
    tasks: [],
    history: [],
    members,
    workload: [],
    risks: [],
    today: TODAY,
    historyStart: "2026-11-01",
    targetDate: null,
    comments: [],
    reviews: [],
    snapshots: [],
    period: "30",
    ...o,
  };
}

describe("periodRange", () => {
  it("clamps to the project's first day", () => {
    expect(periodRange("30", TODAY, "2026-11-01")).toEqual({ start: "2026-11-01", end: TODAY, days: 8 });
  });
  it("uses the full window when history is longer", () => {
    expect(periodRange("14", TODAY, "2026-01-01")).toEqual({ start: "2026-10-26", end: TODAY, days: 14 });
  });
  it("lifetime caps at 400 days", () => {
    expect(periodRange("all", TODAY, "2020-01-01").days).toBe(400);
  });
  it("validates keys", () => {
    expect(isPeriodKey("90")).toBe(true);
    expect(isPeriodKey("7")).toBe(false);
    expect(isPeriodKey(undefined)).toBe(false);
  });
});

describe("buildProjectAnalytics", () => {
  const history: StatusChange[] = [
    { taskId: "a", fromStatus: null, toStatus: "todo", date: "2026-11-01" },
    { taskId: "b", fromStatus: null, toStatus: "todo", date: "2026-11-01" },
    { taskId: "c", fromStatus: null, toStatus: "todo", date: "2026-11-01" },
    { taskId: "a", fromStatus: "todo", toStatus: "in_progress", date: "2026-11-02", at: "2026-11-02T10:00:00Z" },
    { taskId: "a", fromStatus: "in_review", toStatus: "done", date: "2026-11-05", at: "2026-11-05T10:00:00Z" },
  ];
  const tasks = [
    t("a", { status: "done", effort: 3, assigneeIds: ["u1", "u2"], completedDate: "2026-11-05", dueDate: "2026-11-06", milestoneId: "m1" }),
    t("b", { effort: 5, dueDate: "2026-11-04", priority: "high", assigneeIds: ["u1"] }),
    t("c", { effort: null, priority: "urgent", dueDate: "2026-11-01" }),
  ];
  const result = buildProjectAnalytics(
    input({
      tasks,
      history,
      targetDate: "2026-11-15",
      comments: [
        { authorId: "u2", date: "2026-11-03" },
        { authorId: "u2", date: "2026-09-01" }, // outside period
        { authorId: "stranger", date: "2026-11-03" }, // not a member
      ],
      reviews: [{ userId: "u1", date: "2026-11-05" }],
      snapshots: [
        { date: "2026-11-06", score: 70 },
        { date: "2026-11-07", score: null },
      ],
      risks: [
        { type: "OVERDUE", severity: "high", message: "x" },
        { type: "OVERDUE", severity: "high", message: "y" },
        { type: "STALE", severity: "low", message: "z" },
      ],
    }),
  );

  it("computes KPIs from real rows", () => {
    expect(result.kpis.openTasks).toBe(2);
    expect(result.kpis.completedThisWeek).toBe(1);
    expect(result.kpis.onTime).toEqual({ rate: 1, sample: 1 });
    expect(result.kpis.cycle.median).toBe(3);
  });

  it("burndown matches the hand-computed fixture (effort null counts as 1)", () => {
    const at = (d: string) => result.burndown.find((p) => p.date === d)!;
    expect(at("2026-11-01").remaining).toBe(3 + 5 + 1);
    expect(at("2026-11-05").remaining).toBe(5 + 1);
    expect(result.hasIdeal).toBe(true);
    expect(at("2026-11-01").ideal).toBe(9);
  });

  it("splits completed effort between assignees and counts member comments/reviews in period", () => {
    const by = Object.fromEntries(result.contributions.map((c) => [c.userId, c]));
    expect(by.u1).toMatchObject({ effort: 1.5, comments: 0, reviews: 1 });
    expect(by.u2).toMatchObject({ effort: 1.5, comments: 1, reviews: 0 });
    expect(result.contributions.find((c) => c.userId === "stranger")).toBeUndefined();
  });

  it("groups risks and overdue tasks by priority", () => {
    expect(result.risks[0]).toEqual({ type: "OVERDUE", label: "Overdue", count: 2 });
    const od = Object.fromEntries(result.overdueByPriority.map((p) => [p.priority, p.count]));
    expect(od).toEqual({ urgent: 1, high: 1, medium: 0, low: 0, none: 0 });
  });

  it("buckets cycle times and keeps throughput to 12 weeks", () => {
    expect(result.cycleHistogram.find((b) => b.bucket === "2–3 d")!.tasks).toBe(1);
    expect(result.throughput).toHaveLength(12);
    expect(result.throughput.at(-1)).toEqual({ weekStart: "2026-11-02", tasks: 1, effort: 3 });
  });

  it("milestone filter narrows burndown only and drops the ideal line", () => {
    const ms = buildProjectAnalytics(input({ tasks, history, targetDate: "2026-11-15", milestoneId: "m1" }));
    expect(ms.burndown.find((p) => p.date === "2026-11-01")!.remaining).toBe(3);
    expect(ms.hasIdeal).toBe(false);
    expect(ms.kpis.openTasks).toBe(2);
  });

  it("empty project yields empty-state friendly data", () => {
    const e = buildProjectAnalytics(input());
    expect(e.totalTasks).toBe(0);
    expect(e.contributions).toEqual([]);
    expect(e.kpis.onTime.rate).toBeNull();
    expect(e.kpis.cycle.median).toBeNull();
    expect(e.throughput.every((p) => p.tasks === 0)).toBe(true);
  });
});

describe("recommendationRows", () => {
  it("maps recommendations to the save RPC shape", () => {
    const [row] = recommendationRows([
      { taskId: "t", taskKey: "TS-1", taskTitle: "x", fromUserId: "a", toUserId: "b", fromBefore: 1.4, fromAfter: 1.1, toBefore: 0.2, toAfter: 0.5, imbalanceBefore: 0.71234, imbalanceAfter: 0.30001, gain: 0.41, reason: "r" },
    ]);
    expect(row).toMatchObject({ task_id: "t", from_user_id: "a", to_user_id: "b", imbalance_before: 0.712, imbalance_after: 0.3, details: { task_key: "TS-1", to_after: 0.5 } });
  });
});

describe("buildWorkspaceAnalytics", () => {
  const projects = ["P1", "P2", "P3", "P4", "P5"].map((k, i) => ({ id: `p${i + 1}`, key: k, name: `Project ${k}`, status: "active", targetDate: null }));
  const done = (id: string, projectId: string, assignees: string[], completedDate = "2026-11-03", effort = 2) =>
    ({ ...t(id, { status: "done", completedDate, effort, assigneeIds: assignees }), projectId });
  const tasks = [
    done("a", "p1", ["u1"]), done("b", "p1", ["u1", "u2"]), done("c", "p2", ["u2"]), done("d", "p3", ["u3"]),
    done("e", "p4", ["u3"]), done("f", "p5", ["u3"]),
    { ...t("g", { dueDate: "2026-11-01" }), projectId: "p1" },
  ];
  const members = [
    { userId: "u1", name: "Ada", avatarUrl: null, showOnLeaderboard: true },
    { userId: "u2", name: "Alan", avatarUrl: null, showOnLeaderboard: false },
    { userId: "u3", name: "Grace", avatarUrl: null, showOnLeaderboard: true },
  ];
  const snapshots = [
    { projectId: "p1", date: "2026-11-08", score: 62, band: "watch" },
    { projectId: "p1", date: "2026-11-01", score: 70, band: "watch" },
    { projectId: "p2", date: "2026-11-08", score: null, band: "insufficient_data" },
  ];
  const r = buildWorkspaceAnalytics({ projects, tasks, snapshots, members, me: "u2", today: TODAY });

  it("health rows use the latest snapshot and the 7-day delta", () => {
    const p1 = r.health.find((h) => h.key === "P1")!;
    expect(p1).toMatchObject({ score: 62, band: "watch", delta: -8, openTasks: 1, overdue: 1, doneLast30: 2 });
    expect(r.health.find((h) => h.key === "P2")).toMatchObject({ score: null, band: "insufficient_data", delta: null });
    expect(r.totals).toEqual({ projects: 5, openTasks: 1, overdue: 1, doneLast30: 6 });
  });

  it("keeps the top 4 projects as series and folds the rest into Other", () => {
    expect(r.throughputSeries).toHaveLength(5);
    expect(r.throughputSeries[0]).toEqual({ key: "p1", label: "P1" });
    expect(r.throughputSeries.at(-1)!.key).toBe(OTHER_SERIES);
    const week = r.throughput.find((w) => w.weekStart === "2026-11-02")!;
    const total = r.throughputSeries.reduce((s, x) => s + Number(week[x.key]), 0);
    expect(total).toBe(6);
  });

  it("ranks opted-in members only but always shows the viewer", () => {
    expect(r.contributors.map((c) => [c.userId, c.rank, c.effort])).toEqual([
      ["u3", 1, 6],
      ["u1", 2, 3],
      ["u2", null, 3],
    ]);
    expect(r.contributors.at(-1)!.isSelf).toBe(true);
  });
});

describe("buildMyWeek", () => {
  // TODAY = Sunday 2026-11-08; Monday-start week = 2026-11-02 … 2026-11-08
  const base = {
    today: TODAY,
    weekStartsOn: 1 as const,
    historyStart: "2026-10-01",
    streak: { current: 3, longest: 9 },
    completed: [
      { date: "2026-11-02", effort: 3, dueDate: "2026-11-03" },
      { date: "2026-11-04", effort: null, dueDate: "2026-11-01" },
      { date: "2026-10-28", effort: 5, dueDate: null },
      { date: "2026-10-26", effort: 2, dueDate: null },
    ],
    openDue: ["2026-11-07", "2026-11-10", "2026-11-20", null],
  };

  it("compares this week with last week and counts on-time over 4 weeks", async () => {
    const { buildMyWeek } = await import("@/lib/intelligence/my-week");
    const w = buildMyWeek(base);
    expect(w.thisWeek).toEqual({ tasks: 2, effort: 4 });
    expect(w.lastWeek).toEqual({ tasks: 2, effort: 7 });
    expect(w.onTime).toEqual({ rate: 0.5, sample: 2 });
    expect(w.dueNext7).toBe(1);
    expect(w.overdue).toBe(1);
    expect(w.bestWeekday).toEqual({ name: "Monday", tasks: 2 });
    expect(w.weekdayDaysNeeded).toBe(0);
  });

  it("withholds the weekday insight until 14 days of history", async () => {
    const { buildMyWeek } = await import("@/lib/intelligence/my-week");
    const w = buildMyWeek({ ...base, historyStart: "2026-11-01" });
    expect(w.bestWeekday).toBeNull();
    expect(w.weekdayDaysNeeded).toBe(6);
  });
});
