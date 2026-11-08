/** Analytics series reconstructed from task_status_history (spec §B.18, PHASE_3 §5). Pure. */
import { addDaysIso, consideredTasks, daysBetween, effort, weekdayOf } from "./common";
import type { StatusChange, TaskLite } from "./types";
import type { TaskStatus } from "@/lib/domain";

export const MAX_RANGE_DAYS = 400;

export type BurndownPoint = { date: string; remaining: number; ideal: number | null };
export type CfdPoint = { date: string } & Record<Exclude<TaskStatus, "cancelled">, number>;
export type ThroughputPoint = { weekStart: string; tasks: number; effort: number };

function days(start: string, end: string): string[] {
  const out: string[] = [];
  const n = Math.min(daysBetween(start, end), MAX_RANGE_DAYS);
  for (let i = 0; i <= n; i++) out.push(addDaysIso(start, i));
  return out;
}

/** Roll-up structure independent of current cancellation (status comes from history). */
function rollup(tasks: TaskLite[]): TaskLite[] {
  const ids = new Set(
    consideredTasks(tasks.map((t) => ({ ...t, status: t.status === "cancelled" ? ("todo" as const) : t.status }))).map((t) => t.id),
  );
  return tasks.filter((t) => ids.has(t.id));
}

/** Status of each task at the end of each day, from its change log. */
function statusTimeline(history: StatusChange[]) {
  const byTask = new Map<string, StatusChange[]>();
  for (const h of history) byTask.set(h.taskId, [...(byTask.get(h.taskId) ?? []), h]);
  for (const list of byTask.values()) list.sort((a, b) => (a.at ?? a.date).localeCompare(b.at ?? b.date));
  return (taskId: string, day: string): TaskStatus | null => {
    const list = byTask.get(taskId);
    if (!list) return null;
    let s: TaskStatus | null = null;
    for (const h of list) {
      if (h.date <= day) s = h.toStatus;
      else break;
    }
    return s;
  };
}

/**
 * Remaining effort at end of each day = Σ effort of considered tasks that existed (created ≤ d)
 * and whose latest status at d ∉ {done, cancelled}. Ideal line from the first day's total to 0
 * at `targetDate` (null when no target date).
 */
export function burndownSeries(history: StatusChange[], tasks: TaskLite[], range: { start: string; end: string }, targetDate?: string | null): BurndownPoint[] {
  const T = rollup(tasks);
  const at = statusTimeline(history);
  const series = days(range.start, range.end).map((d) => {
    let remaining = 0;
    for (const t of T) {
      if (t.createdDate && t.createdDate > d) continue;
      const s = at(t.id, d);
      if (s === null || s === "done" || s === "cancelled") continue;
      remaining += effort(t);
    }
    return { date: d, remaining, ideal: null as number | null };
  });
  if (targetDate && series.length && targetDate > range.start) {
    const total0 = series[0]!.remaining;
    const span = daysBetween(range.start, targetDate);
    for (const p of series) p.ideal = Math.max(0, Math.round(total0 * (1 - daysBetween(range.start, p.date) / span) * 100) / 100);
  }
  return series;
}

export function cumulativeFlow(history: StatusChange[], tasks: TaskLite[], range: { start: string; end: string }): CfdPoint[] {
  const T = rollup(tasks);
  const at = statusTimeline(history);
  return days(range.start, range.end).map((d) => {
    const p: CfdPoint = { date: d, backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0 };
    for (const t of T) {
      if (t.createdDate && t.createdDate > d) continue;
      const s = at(t.id, d);
      if (s && s !== "cancelled") p[s] += effort(t);
    }
    return p;
  });
}

export function weekStartOf(iso: string, weekStartsOn: 0 | 1 = 1): string {
  const w = weekdayOf(iso);
  const back = (w - weekStartsOn + 7) % 7;
  return addDaysIso(iso, -back);
}

/** Tasks & effort completed per week for the last `weeks` weeks (current week last). */
export function throughputByWeek(tasks: TaskLite[], weeks: number, today: string, weekStartsOn: 0 | 1 = 1): ThroughputPoint[] {
  const current = weekStartOf(today, weekStartsOn);
  const points: ThroughputPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) points.push({ weekStart: addDaysIso(current, -7 * i), tasks: 0, effort: 0 });
  const index = new Map(points.map((p, i) => [p.weekStart, i]));
  for (const t of consideredTasks(tasks)) {
    if (t.status !== "done" || !t.completedDate) continue;
    const i = index.get(weekStartOf(t.completedDate, weekStartsOn));
    if (i === undefined) continue;
    points[i]!.tasks += 1;
    points[i]!.effort += effort(t);
  }
  return points;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.max(0, Math.ceil(q * sorted.length) - 1); // nearest-rank
  return sorted[idx]!;
}

/** Days from first `in_progress` to the next `done`, per task. */
export function cycleTimeDays(history: StatusChange[]): { median: number | null; p85: number | null; sample: number; values: number[] } {
  const byTask = new Map<string, StatusChange[]>();
  for (const h of history) byTask.set(h.taskId, [...(byTask.get(h.taskId) ?? []), h]);
  const values: number[] = [];
  for (const list of byTask.values()) {
    list.sort((a, b) => (a.at ?? a.date).localeCompare(b.at ?? b.date));
    const start = list.find((h) => h.toStatus === "in_progress");
    if (!start) continue;
    const end = list.find((h) => h.toStatus === "done" && (h.at ?? h.date) >= (start.at ?? start.date));
    if (!end) continue;
    values.push(daysBetween(start.date, end.date));
  }
  values.sort((a, b) => a - b);
  const median = values.length ? (values.length % 2 ? values[(values.length - 1) / 2]! : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2) : null;
  return { median, p85: quantile(values, 0.85), sample: values.length, values };
}

/** On-time rate among completed tasks with a due date (done on/before due). */
export function onTimeRate(tasks: TaskLite[]): { rate: number | null; sample: number } {
  const done = consideredTasks(tasks).filter((t) => t.status === "done" && t.dueDate && t.completedDate);
  if (!done.length) return { rate: null, sample: 0 };
  return { rate: done.filter((t) => t.completedDate! <= t.dueDate!).length / done.length, sample: done.length };
}
