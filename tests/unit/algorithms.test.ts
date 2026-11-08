import { describe, expect, it } from "vitest";
import { burndownSeries, cumulativeFlow, cycleTimeDays, onTimeRate, throughputByWeek, weekStartOf } from "@/lib/algorithms/analytics";
import { addDaysIso, consideredTasks, daysBetween, effectivelyBlocked, openBlockedBy } from "@/lib/algorithms/common";
import { findPath, longestOpenChain, wouldCreateCycle } from "@/lib/algorithms/dependencies";
import { forecastFinish, priorityScore, velocityPerDay } from "@/lib/algorithms/forecast";
import { levelForXp, nextStreak, onlyWeekendBetween, timingMultiplier, xpForCompletion } from "@/lib/algorithms/gamification";
import { bandFor, computePulse, type PulseInput } from "@/lib/algorithms/pulse";
import { detectRisks } from "@/lib/algorithms/risk";
import type { MemberLite, StatusChange, TaskLite } from "@/lib/algorithms/types";
import { computeWorkload, imbalanceOf, recommendReassignments, urgencyFactor } from "@/lib/algorithms/workload";
import type { TaskPriority, TaskStatus } from "@/lib/domain";

const TODAY = "2026-11-08"; // Sunday

let seq = 0;
function task(p: Partial<TaskLite> = {}): TaskLite {
  seq += 1;
  return {
    id: p.id ?? `t${seq}`,
    key: p.key ?? `TS-${seq}`,
    title: p.title ?? `Task ${seq}`,
    parentTaskId: null,
    status: "todo",
    priority: "medium",
    effort: 3,
    dueDate: null,
    isBlocked: false,
    assigneeIds: [],
    milestoneId: null,
    createdDate: "2026-11-01",
    completedDate: null,
    ...p,
  };
}
const member = (userId: string, capacity = 20, role: MemberLite["role"] = "contributor"): MemberLite => ({ userId, capacity, role, name: userId.toUpperCase() });

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe("common", () => {
  it("dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-29", 1)).toBe("2026-03-30"); // DST-safe (UTC arithmetic)
  });
  it("consideredTasks rolls subtasks into parents unless the parent has no effort", () => {
    const p1 = task({ id: "p1", effort: 5 });
    const s1 = task({ id: "s1", parentTaskId: "p1", effort: 2 });
    const p2 = task({ id: "p2", effort: null });
    const s2 = task({ id: "s2", parentTaskId: "p2", effort: 3 });
    const s3 = task({ id: "s3", parentTaskId: "p2", effort: 1 });
    const c = task({ id: "c", status: "cancelled" });
    const ids = consideredTasks([p1, s1, p2, s2, s3, c]).map((t) => t.id).sort();
    expect(ids).toEqual(["p1", "s2", "s3"]);
  });
  it("effectivelyBlocked: manual flag or open blocker", () => {
    const a = task({ id: "a" });
    const b = task({ id: "b" });
    const done = task({ id: "d", status: "done" });
    const byId = new Map([a, b, done].map((t) => [t.id, t]));
    expect(effectivelyBlocked(b, [{ blockerId: "a", blockedId: "b" }], byId)).toBe(true);
    expect(effectivelyBlocked(b, [{ blockerId: "d", blockedId: "b" }], byId)).toBe(false);
    expect(effectivelyBlocked({ ...b, isBlocked: true }, [], byId)).toBe(true);
    expect(openBlockedBy("a", [{ blockerId: "a", blockedId: "b" }], byId)).toBe(1);
  });
});

describe("computePulse", () => {
  const base = (tasks: TaskLite[], extra: Partial<PulseInput> = {}): PulseInput => ({
    project: { startDate: null, targetDate: null },
    tasks,
    members: [member("u1"), member("u2")],
    deps: [],
    milestones: [],
    today: TODAY,
    ...extra,
  });

  it("insufficient data under 3 considered tasks", () => {
    const r = computePulse(base([task(), task(), task({ status: "cancelled" })]));
    expect(r.score).toBeNull();
    expect(r.band).toBe("insufficient_data");
    expect(r.reasons).toEqual(["Add at least 3 tasks"]);
  });

  it("all done = 100 healthy", () => {
    const r = computePulse(base([task({ status: "done" }), task({ status: "done" }), task({ status: "done" })]));
    expect(r.score).toBe(100);
    expect(r.band).toBe("healthy");
  });

  it("no timeline: f1 = completion; no due dates → info note, f2 = f3 = 1", () => {
    const r = computePulse(base([task({ status: "done", effort: 1 }), task({ effort: 1 }), task({ effort: 2 })]));
    const f = Object.fromEntries(r.factors.map((x) => [x.key, x.subScore]));
    expect(f.schedule).toBeCloseTo(0.25);
    expect(f.overdue).toBe(1);
    expect(f.deadline).toBe(1);
    expect(r.infos[0]).toMatch(/No due dates/);
  });

  it("timeline-relative schedule and past-target cap", () => {
    const tasks = [task({ status: "done", effort: 5 }), task({ effort: 5 }), task({ effort: 10 })];
    const onTrack = computePulse(base(tasks, { project: { startDate: "2026-11-01", targetDate: "2026-11-29" } }));
    expect(onTrack.factors[0]!.subScore).toBeCloseTo(0.25 / 0.25); // 25% done at 25% elapsed → 1
    const late = computePulse(base(tasks, { project: { startDate: "2026-10-01", targetDate: "2026-11-01" } }));
    expect(late.factors[0]!.subScore).toBeLessThanOrEqual(0.3);
  });

  it("overdue pressure uses priority and age factor", () => {
    const tasks = [
      task({ dueDate: "2026-11-01", priority: "urgent", effort: 2 }), // 7 days late → age 1.5
      task({ effort: 2, priority: "medium" }),
      task({ effort: 2, priority: "medium" }),
    ];
    const r = computePulse(base(tasks));
    const overdueW = 2 * 2.0 * 1.5;
    const openW = 2 * 2.0 + 2 + 2;
    expect(r.factors.find((f) => f.key === "overdue")!.subScore).toBeCloseTo(1 - overdueW / openW);
    expect(r.reasons.some((x) => /Overdue pressure/.test(x))).toBe(true);
    expect(r.actions.some((a) => a.href === "list?due=overdue")).toBe(true);
  });

  it("deadline readiness and blocked caps", () => {
    const tasks = [
      task({ dueDate: "2026-11-10", status: "todo", effort: 3 }),
      task({ dueDate: "2026-11-09", status: "in_progress", effort: 1 }),
      task({ priority: "urgent", isBlocked: true, effort: 1 }),
    ];
    const r = computePulse(base(tasks));
    const f = Object.fromEntries(r.factors.map((x) => [x.key, x.subScore]));
    expect(f.deadline).toBeCloseTo(1 - 3 / 4);
    expect(f.blocked).toBeLessThanOrEqual(0.6);
  });

  it("single member → workload factor 1", () => {
    const tasks = [task({ assigneeIds: ["u1"] }), task({ assigneeIds: ["u1"] }), task({ assigneeIds: ["u1"] })];
    const r = computePulse(base(tasks, { members: [member("u1")] }));
    expect(r.factors.find((f) => f.key === "workload")!.subScore).toBe(1);
  });

  it("explainability: factor points sum to score ± 0.5 over 500 seeded random projects", () => {
    const rnd = seeded(42);
    const statuses: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
    const prios: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];
    for (let i = 0; i < 500; i++) {
      const n = 3 + Math.floor(rnd() * 25);
      const tasks = Array.from({ length: n }, () =>
        task({
          status: statuses[Math.floor(rnd() * statuses.length)]!,
          priority: prios[Math.floor(rnd() * prios.length)]!,
          effort: rnd() < 0.2 ? null : [1, 2, 3, 5, 8, 13][Math.floor(rnd() * 6)]!,
          dueDate: rnd() < 0.5 ? addDaysIso(TODAY, Math.floor(rnd() * 30) - 15) : null,
          isBlocked: rnd() < 0.1,
          assigneeIds: rnd() < 0.7 ? [rnd() < 0.5 ? "u1" : "u2"] : [],
        }),
      );
      const r = computePulse(base(tasks, { project: { startDate: "2026-10-15", targetDate: rnd() < 0.5 ? "2026-12-15" : null } }));
      if (r.score === null) continue;
      const sum = r.factors.reduce((s, f) => s + f.points, 0);
      expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(0.5);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("monotonicity: adding an overdue task never increases the score; completing never lowers f1", () => {
    const rnd = seeded(7);
    for (let i = 0; i < 100; i++) {
      const tasks = Array.from({ length: 6 }, () => task({ effort: 1 + Math.floor(rnd() * 5), status: rnd() < 0.3 ? "done" : "todo" }));
      const before = computePulse(base(tasks));
      const after = computePulse(base([...tasks, task({ dueDate: "2026-11-01", priority: "high" })]));
      expect(after.score!).toBeLessThanOrEqual(before.score!);
      const open = tasks.find((t) => t.status !== "done");
      if (open) {
        const completed = computePulse(base(tasks.map((t) => (t === open ? { ...t, status: "done" as const } : t))));
        expect(completed.factors[0]!.subScore).toBeGreaterThanOrEqual(before.factors[0]!.subScore);
      }
    }
  });

  it("bands", () => {
    expect(bandFor(80)).toBe("healthy");
    expect(bandFor(60)).toBe("watch");
    expect(bandFor(40)).toBe("at_risk");
    expect(bandFor(39)).toBe("critical");
  });
});

describe("workload", () => {
  it("utilisation, backlog excluded, multi-assignee split, capacity 0 excluded", () => {
    const tasks = [
      task({ assigneeIds: ["a"], effort: 4, priority: "medium" }), // 4
      task({ assigneeIds: ["a", "b"], effort: 4, priority: "medium" }), // 2 each
      task({ assigneeIds: ["a"], effort: 8, status: "backlog" }), // ignored
      task({ assigneeIds: ["c"], effort: 5 }), // c has capacity 0
      task({ effort: 2 }), // unassigned
    ];
    const W = computeWorkload({ tasks, members: [member("a", 10), member("b", 10), member("c", 0)], today: TODAY });
    const a = W.members.find((m) => m.userId === "a")!;
    expect(a.load).toBe(6);
    expect(a.utilisation).toBeCloseTo(0.6);
    expect(W.members.some((m) => m.userId === "c")).toBe(false);
    expect(W.unassignedOpenEffort).toBe(2);
    expect(W.imbalanceIndex).toBeGreaterThanOrEqual(0);
    expect(W.imbalanceIndex).toBeLessThanOrEqual(1);
  });
  it("urgency factor and imbalance bounds", () => {
    expect(urgencyFactor("2026-11-01", TODAY)).toBe(1.5);
    expect(urgencyFactor("2026-11-12", TODAY)).toBe(1.25);
    expect(urgencyFactor("2026-12-30", TODAY)).toBe(1);
    expect(urgencyFactor(null, TODAY)).toBe(1);
    expect(imbalanceOf([])).toBe(0);
    expect(imbalanceOf([0, 0])).toBe(0);
    expect(imbalanceOf([5, 0, 0, 0, 0, 0])).toBe(1);
  });
  it("recommendations reduce imbalance and respect every constraint", () => {
    const tasks = [
      ...Array.from({ length: 6 }, (_, i) => task({ id: `a${i}`, key: `TS-${i}`, assigneeIds: ["a"], effort: 5, priority: "high" })),
      task({ id: "ip", assigneeIds: ["a"], effort: 8, status: "in_progress" }),
      task({ id: "multi", assigneeIds: ["a", "b"], effort: 8 }),
      task({ id: "blk", assigneeIds: ["a"], effort: 8, isBlocked: true }),
      task({ assigneeIds: ["b"], effort: 1 }),
    ];
    const input = { tasks, members: [member("a", 20), member("b", 20), member("v", 20, "viewer")], today: TODAY };
    const recs = recommendReassignments(input);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.imbalanceBefore - r.imbalanceAfter).toBeGreaterThanOrEqual(0.02 - 1e-9);
      expect(r.toAfter).toBeLessThanOrEqual(0.9 + 1e-9);
      expect(["ip", "multi", "blk"]).not.toContain(r.taskId);
      expect(r.toUserId).not.toBe("v");
      expect(r.reason).toMatch(/lowers imbalance from/);
    }
  });
  it("all members over capacity → no suggestions", () => {
    const tasks = [
      ...Array.from({ length: 5 }, () => task({ assigneeIds: ["a"], effort: 8, priority: "urgent" })),
      ...Array.from({ length: 5 }, () => task({ assigneeIds: ["b"], effort: 8, priority: "urgent" })),
    ];
    expect(recommendReassignments({ tasks, members: [member("a", 10), member("b", 10)], today: TODAY })).toEqual([]);
  });
  it("recently handled tasks are skipped", () => {
    const tasks = [
      task({ id: "x", assigneeIds: ["a"], effort: 8 }),
      task({ id: "y", assigneeIds: ["a"], effort: 8, status: "in_progress" }),
      task({ assigneeIds: ["b"], effort: 1, priority: "low" }),
    ];
    const input = { tasks, members: [member("a", 10), member("b", 20)], today: TODAY };
    expect(recommendReassignments(input).map((r) => r.taskId)).toEqual(["x"]);
    expect(recommendReassignments(input, { recentlyHandled: new Set(["x"]) })).toEqual([]);
  });
});

describe("dependencies", () => {
  const e = (a: string, b: string) => ({ blockerId: a, blockedId: b });
  it("wouldCreateCycle: self, direct, indirect, diamond, long chain", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
    expect(wouldCreateCycle([e("a", "b")], "b", "a")).toBe(true);
    expect(wouldCreateCycle([e("a", "b"), e("b", "c")], "c", "a")).toBe(true);
    expect(wouldCreateCycle([e("a", "b"), e("a", "c"), e("b", "d"), e("c", "d")], "a", "d")).toBe(false);
    const chain = Array.from({ length: 200 }, (_, i) => e(`n${i}`, `n${i + 1}`));
    expect(wouldCreateCycle(chain, "n200", "n0")).toBe(true);
    expect(wouldCreateCycle(chain, "n0", "n200")).toBe(false);
  });
  it("findPath and longest open chain", () => {
    expect(findPath([e("a", "b"), e("b", "c")], "a", "c")).toEqual(["a", "b", "c"]);
    expect(findPath([e("a", "b")], "b", "a")).toBeNull();
    const tasks = [task({ id: "a", effort: 1 }), task({ id: "b", effort: 5 }), task({ id: "c", effort: 1 }), task({ id: "d", effort: 2, status: "done" })];
    const chain = longestOpenChain(tasks, [e("a", "b"), e("b", "c"), e("a", "c"), e("c", "d")]);
    expect(chain.taskIds).toEqual(["a", "b", "c"]);
    expect(chain.remainingEffort).toBe(7);
  });
});

describe("forecast & priority", () => {
  it("needs ≥ 3 days of history and some velocity", () => {
    expect(forecastFinish([{ date: "2026-11-07", effort: 3 }], 10, TODAY, "2026-11-07")).toBeNull();
    expect(velocityPerDay([], TODAY, "2026-10-01")).toBeNull();
    const hist = [{ date: "2026-11-02", effort: 7 }, { date: "2026-11-06", effort: 7 }];
    expect(velocityPerDay(hist, TODAY, "2026-10-01")).toBeCloseTo(1);
    expect(forecastFinish(hist, 10, TODAY, "2026-10-01")).toBe("2026-11-18");
    expect(forecastFinish(hist, 0, TODAY)).toBe(TODAY);
  });
  it("priorityScore", () => {
    const a = task({ id: "pa", priority: "urgent", dueDate: "2026-11-10", status: "in_review" });
    const b = task({ id: "pb", priority: "low" });
    const byId = new Map([a, b].map((t) => [t.id, t]));
    const s = priorityScore(a, { today: TODAY, deps: [{ blockerId: "pa", blockedId: "pb" }], byId });
    expect(s).toBe(2 * 30 + 12 * 3 + 12 + 10);
    expect(priorityScore(b, { today: TODAY, deps: [{ blockerId: "pa", blockedId: "pb" }], byId })).toBe(0.75 * 30 - 25);
  });
});

describe("detectRisks", () => {
  const base = { deps: [], members: [member("a", 10), member("b", 10)], milestones: [], today: TODAY, completions: [] };
  it("flags each type and stays quiet otherwise", () => {
    const tasks = [
      task({ id: "od", key: "TS-1", dueDate: "2026-11-01", priority: "high" }),
      task({ id: "ds", key: "TS-2", dueDate: "2026-11-09", status: "todo", assigneeIds: ["b"] }),
      task({ id: "st", key: "TS-3", status: "in_progress", assigneeIds: ["b"] }),
      task({ id: "bh", key: "TS-4", priority: "urgent", isBlocked: true, assigneeIds: ["b"] }),
      task({ id: "un", key: "TS-5", dueDate: "2026-11-12" }),
      ...Array.from({ length: 4 }, (_, i) => task({ id: `ov${i}`, assigneeIds: ["a"], effort: 8, priority: "urgent" })),
    ];
    const risks = detectRisks({ ...base, tasks, lastStatusChange: new Map([["st", "2026-10-20"]]) });
    const types = new Set(risks.map((r) => r.type));
    for (const t of ["OVERDUE", "DUE_SOON_NOT_STARTED", "STALE", "BLOCKED_HIGH_PRIORITY", "UNASSIGNED_DUE_SOON", "OWNER_OVERLOADED"]) expect(types.has(t as never)).toBe(true);
    expect(risks[0]!.severity).toBe("high");
    expect(detectRisks({ ...base, tasks: [task(), task({ status: "done" })] })).toEqual([]);
  });
  it("schedule conflict, milestone at risk, critical chain", () => {
    const tasks = [
      task({ id: "x", dueDate: "2026-11-20", milestoneId: "m1", effort: 8 }),
      task({ id: "y", dueDate: "2026-11-15", milestoneId: "m1", effort: 8 }),
      task({ id: "z", dueDate: "2026-11-16", effort: 8 }),
    ];
    const deps = [{ blockerId: "x", blockedId: "y" }, { blockerId: "y", blockedId: "z" }];
    const risks = detectRisks({
      ...base,
      tasks,
      deps,
      milestones: [{ id: "m1", name: "Build", dueDate: "2026-11-10", status: "open" }],
      completions: [{ date: "2026-11-05", effort: 2 }],
      historyStart: "2026-10-01",
    });
    const types = risks.map((r) => r.type);
    expect(types).toContain("SCHEDULE_CONFLICT");
    expect(types).toContain("MILESTONE_AT_RISK");
    expect(types).toContain("CRITICAL_CHAIN");
  });
});

describe("gamification mirrors", () => {
  it("XP: priority × effort × timing + unblock, split with ceil", () => {
    expect(timingMultiplier(null, TODAY)).toBe(1);
    expect(timingMultiplier("2026-11-08", TODAY)).toBe(1.25);
    expect(timingMultiplier("2026-11-06", TODAY)).toBe(1);
    expect(timingMultiplier("2026-11-01", TODAY)).toBe(0.6);
    const r = xpForCompletion({ priority: "high", effort: 5, dueDate: "2026-11-10", completedDate: TODAY, openBlockedByThis: 4, assigneeCount: 2 });
    expect(r.total).toBe(Math.round(35 * 1.5 * 1.25) + 30);
    expect(r.xp).toBe(Math.ceil(r.total / 2));
    expect(xpForCompletion({ priority: "none", effort: null, dueDate: null, completedDate: TODAY, openBlockedByThis: 0, assigneeCount: 1 }).xp).toBe(11);
  });
  it("trivial rule and daily cap", () => {
    expect(xpForCompletion({ priority: "urgent", effort: 1, dueDate: null, completedDate: TODAY, openBlockedByThis: 0, assigneeCount: 1, trivial: true }).xp).toBe(0);
    const capped = xpForCompletion({ priority: "urgent", effort: 8, dueDate: null, completedDate: TODAY, openBlockedByThis: 0, assigneeCount: 1, earnedToday: 480 });
    expect(capped.xp).toBe(20);
    expect(capped.capped).toBe(true);
  });
  it("levels", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(50).level).toBe(2);
    expect(levelForXp(200).level).toBe(3);
    expect(levelForXp(800).level).toBe(5);
    expect(levelForXp(4050).level).toBe(10);
    expect(levelForXp(125).progress).toBeCloseTo(0.5);
    expect(levelForXp(-5).level).toBe(1);
  });
  it("streaks: consecutive, gap, weekend protection, duplicate day", () => {
    let s = nextStreak({ current: 0, longest: 0, lastActiveDate: null }, "2026-11-05", { weekendProtection: true });
    expect(s.current).toBe(1);
    s = nextStreak(s, "2026-11-06", { weekendProtection: true }); // Fri
    expect(s.current).toBe(2);
    expect(nextStreak(s, "2026-11-06", { weekendProtection: true })).toBe(s);
    const monday = nextStreak(s, "2026-11-09", { weekendProtection: true }); // skipped Sat+Sun
    expect(monday.current).toBe(3);
    expect(nextStreak(s, "2026-11-09", { weekendProtection: false }).current).toBe(1);
    expect(nextStreak(s, "2026-11-11", { weekendProtection: true }).current).toBe(1);
    expect(monday.longest).toBe(3);
    expect(onlyWeekendBetween("2026-11-06", "2026-11-09")).toBe(true);
  });
});

describe("analytics", () => {
  const h = (taskId: string, toStatus: TaskStatus, date: string, fromStatus: TaskStatus | null = null): StatusChange => ({ taskId, toStatus, fromStatus, date, at: `${date}T10:00:00Z` });
  const tasks = [
    task({ id: "a", effort: 3, createdDate: "2026-11-01", status: "done", completedDate: "2026-11-04", dueDate: "2026-11-05" }),
    task({ id: "b", effort: 2, createdDate: "2026-11-01", status: "in_progress" }),
    task({ id: "c", effort: 5, createdDate: "2026-11-03", status: "done", completedDate: "2026-11-07", dueDate: "2026-11-06" }),
  ];
  const history = [
    h("a", "todo", "2026-11-01"), h("a", "in_progress", "2026-11-02", "todo"), h("a", "done", "2026-11-04", "in_progress"),
    h("b", "todo", "2026-11-01"), h("b", "in_progress", "2026-11-05", "todo"),
    h("c", "todo", "2026-11-03"), h("c", "in_progress", "2026-11-03", "todo"), h("c", "done", "2026-11-07", "in_progress"),
  ];
  it("burndown matches hand-computed fixture", () => {
    const s = burndownSeries(history, tasks, { start: "2026-11-01", end: "2026-11-08" }, "2026-11-11");
    expect(s.map((p) => p.remaining)).toEqual([5, 5, 10, 7, 7, 7, 2, 2]);
    expect(s[0]!.ideal).toBe(5);
    expect(s[s.length - 1]!.ideal).toBeCloseTo(5 * (1 - 7 / 10));
    expect(burndownSeries(history, tasks, { start: "2026-11-01", end: "2026-11-02" }, null)[0]!.ideal).toBeNull();
  });
  it("cumulative flow", () => {
    const c = cumulativeFlow(history, tasks, { start: "2026-11-04", end: "2026-11-04" });
    expect(c[0]).toMatchObject({ done: 3, todo: 2, in_progress: 5 });
  });
  it("throughput by week (Monday start)", () => {
    expect(weekStartOf("2026-11-08", 1)).toBe("2026-11-02");
    expect(weekStartOf("2026-11-08", 0)).toBe("2026-11-08");
    const t = throughputByWeek(tasks, 2, TODAY, 1);
    expect(t).toEqual([
      { weekStart: "2026-10-26", tasks: 0, effort: 0 },
      { weekStart: "2026-11-02", tasks: 2, effort: 8 },
    ]);
  });
  it("cycle time and on-time rate", () => {
    const c = cycleTimeDays(history);
    expect(c.values).toEqual([2, 4]);
    expect(c.median).toBe(3);
    expect(c.p85).toBe(4);
    expect(cycleTimeDays([]).median).toBeNull();
    expect(onTimeRate(tasks)).toEqual({ rate: 0.5, sample: 2 });
  });
});
