/** Workload Balance Engine — spec §G.2 (pure). */
import { clamp, daysBetween, effectivelyBlocked, effort, isOpen, PRIORITY_WEIGHT } from "./common";
import type { DepLite, MemberLite, TaskLite } from "./types";

export type MemberStatus = "overloaded" | "balanced" | "underutilized";

export type MemberLoad = {
  userId: string;
  name: string;
  capacity: number;
  load: number;
  utilisation: number;
  status: MemberStatus;
  openTaskCount: number;
};

export type WorkloadInput = {
  tasks: TaskLite[]; // considered tasks (open ones are used)
  members: MemberLite[];
  deps?: DepLite[];
  today: string;
};

export type WorkloadResult = {
  members: MemberLoad[];
  activeMembers: number;
  imbalanceIndex: number;
  overloadedCount: number;
  unassignedOpenEffort: number;
  meanUtilisation: number;
};

export const OVERLOAD = 1.1;
export const UNDERUSE = 0.5;
export const RECEIVER_MAX = 0.9;
export const MIN_GAIN = 0.02;

export function urgencyFactor(due: string | null, today: string): number {
  if (!due) return 1.0;
  if (due < today) return 1.5;
  return daysBetween(today, due) <= 7 ? 1.25 : 1.0;
}

/** Weighted load a task adds (before splitting among assignees). */
export function taskWeight(t: TaskLite, today: string): number {
  return effort(t) * PRIORITY_WEIGHT[t.priority] * urgencyFactor(t.dueDate, today);
}

export function statusFor(util: number): MemberStatus {
  return util > OVERLOAD ? "overloaded" : util < UNDERUSE ? "underutilized" : "balanced";
}

/** Coefficient of variation of utilisation, clamped to [0,1] (CV ≥ 1 → max imbalance). */
export function imbalanceOf(utils: number[]): number {
  if (utils.length === 0) return 0;
  const mean = utils.reduce((s, u) => s + u, 0) / utils.length;
  if (mean === 0) return 0;
  const variance = utils.reduce((s, u) => s + (u - mean) ** 2, 0) / utils.length;
  return clamp(Math.sqrt(variance) / mean, 0, 1);
}

export function computeWorkload(input: WorkloadInput): WorkloadResult {
  const active = input.members.filter((m) => (m.role === "lead" || m.role === "contributor") && m.capacity > 0);
  const activeIds = new Set(active.map((m) => m.userId));
  const load = new Map(active.map((m) => [m.userId, 0]));
  const counts = new Map(active.map((m) => [m.userId, 0]));
  let unassigned = 0;

  for (const t of input.tasks) {
    if (!isOpen(t) || t.status === "backlog") continue; // backlog = not committed work
    const A = t.assigneeIds.filter((a) => activeIds.has(a));
    if (A.length === 0) {
      if (t.assigneeIds.length === 0) unassigned += effort(t);
      continue;
    }
    const share = taskWeight(t, input.today) / A.length;
    for (const a of A) {
      load.set(a, (load.get(a) ?? 0) + share);
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }

  const members: MemberLoad[] = active.map((m) => {
    const l = load.get(m.userId) ?? 0;
    const u = l / m.capacity;
    return {
      userId: m.userId,
      name: m.name ?? "Member",
      capacity: m.capacity,
      load: l,
      utilisation: u,
      status: statusFor(u),
      openTaskCount: counts.get(m.userId) ?? 0,
    };
  });
  const utils = members.map((m) => m.utilisation);
  return {
    members,
    activeMembers: members.length,
    imbalanceIndex: imbalanceOf(utils),
    overloadedCount: members.filter((m) => m.status === "overloaded").length,
    unassignedOpenEffort: unassigned,
    meanUtilisation: utils.length ? utils.reduce((s, u) => s + u, 0) / utils.length : 0,
  };
}

export type Recommendation = {
  taskId: string;
  taskKey: string;
  taskTitle: string;
  fromUserId: string;
  toUserId: string;
  fromBefore: number;
  fromAfter: number;
  toBefore: number;
  toAfter: number;
  imbalanceBefore: number;
  imbalanceAfter: number;
  gain: number;
  reason: string;
};

const pctText = (u: number) => `${Math.round(u * 100)} %`;
const fmtPts = (n: number) => (Math.round(n * 10) / 10).toString();

export function recommendReassignments(
  input: WorkloadInput,
  opts: { max?: number; recentlyHandled?: Set<string> } = {},
): Recommendation[] {
  const max = opts.max ?? 5;
  const W = computeWorkload(input);
  if (W.activeMembers < 2) return [];
  const util = new Map(W.members.map((m) => [m.userId, m.utilisation]));
  const cap = new Map(W.members.map((m) => [m.userId, m.capacity]));
  const names = new Map(W.members.map((m) => [m.userId, m.name]));
  const loads = new Map(W.members.map((m) => [m.userId, m.load]));
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const moved = new Set<string>();
  const out: Recommendation[] = [];
  let index = W.imbalanceIndex;

  for (let i = 0; i < max; i++) {
    const donors = [...util.entries()].filter(([, u]) => u > OVERLOAD).sort((a, b) => b[1] - a[1]);
    if (donors.length === 0) break;
    const donor = donors[0]![0];
    const candidates = input.tasks
      .filter(
        (t) =>
          isOpen(t) &&
          !moved.has(t.id) &&
          t.assigneeIds.length === 1 &&
          t.assigneeIds[0] === donor &&
          (t.status === "todo" || t.status === "backlog") && // never move in-progress work
          !effectivelyBlocked(t, input.deps ?? [], byId) &&
          !opts.recentlyHandled?.has(t.id),
      )
      .map((t) => ({ t, share: t.status === "backlog" ? 0 : taskWeight(t, input.today) }))
      .sort((a, b) => b.share - a.share || (a.t.dueDate ?? "9999").localeCompare(b.t.dueDate ?? "9999"));

    let best: { t: TaskLite; share: number; r: string; gain: number; newIndex: number } | null = null;
    for (const { t, share } of candidates) {
      for (const [r, uR] of util) {
        if (r === donor) continue;
        const capR = cap.get(r)!;
        const newUtilR = uR + share / capR;
        if (newUtilR > RECEIVER_MAX) continue;
        const sim = new Map(util);
        sim.set(r, newUtilR);
        sim.set(donor, util.get(donor)! - share / cap.get(donor)!);
        const newIndex = imbalanceOf([...sim.values()]);
        const gain = index - newIndex;
        if (gain >= MIN_GAIN && (best === null || gain > best.gain)) best = { t, share, r, gain, newIndex };
      }
    }
    if (!best) break;

    const fromBefore = util.get(donor)!;
    const toBefore = util.get(best.r)!;
    const fromAfter = fromBefore - best.share / cap.get(donor)!;
    const toAfter = toBefore + best.share / cap.get(best.r)!;
    const key = best.t.key ?? "task";
    const due = best.t.dueDate ? `, due ${best.t.dueDate}` : "";
    out.push({
      taskId: best.t.id,
      taskKey: key,
      taskTitle: best.t.title ?? "",
      fromUserId: donor,
      toUserId: best.r,
      fromBefore,
      fromAfter,
      toBefore,
      toAfter,
      imbalanceBefore: index,
      imbalanceAfter: best.newIndex,
      gain: best.gain,
      reason:
        `${names.get(donor)} is at ${pctText(fromBefore)} of capacity (${fmtPts(loads.get(donor)!)}/${cap.get(donor)} pts) while ` +
        `${names.get(best.r)} is at ${pctText(toBefore)}. Moving ${key} (${effort(best.t)} pts, ${best.t.priority}${due}) lowers imbalance from ` +
        `${index.toFixed(2)} to ${best.newIndex.toFixed(2)}.`,
    });
    util.set(donor, fromAfter);
    util.set(best.r, toAfter);
    loads.set(donor, loads.get(donor)! - best.share);
    loads.set(best.r, loads.get(best.r)! + best.share);
    moved.add(best.t.id);
    index = best.newIndex;
  }
  return out;
}
