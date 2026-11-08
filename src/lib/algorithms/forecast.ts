/** Velocity forecast & deterministic priority score — spec §G.5 (pure). */
import { addDaysIso, clamp, daysBetween, effectivelyBlocked, openBlockedBy, PRIORITY_WEIGHT } from "./common";
import type { CompletionPoint, DepLite, TaskLite } from "./types";

export const VELOCITY_WINDOW = 14;
export const MIN_HISTORY_DAYS = 3;

/**
 * Completed effort per day over the last 14 days (window shortened to the days since the project
 * started; at least 3 days of history required). Returns null when there is not enough history.
 */
export function velocityPerDay(history: CompletionPoint[], today: string, historyStart?: string | null): number | null {
  const start = historyStart ?? history.map((h) => h.date).sort()[0] ?? null;
  if (!start) return null;
  const since = daysBetween(start, today);
  if (since < MIN_HISTORY_DAYS) return null;
  const window = Math.min(VELOCITY_WINDOW, since);
  const from = addDaysIso(today, -window); // exclusive
  const done = history.filter((h) => h.date > from && h.date <= today).reduce((s, h) => s + h.effort, 0);
  if (done <= 0) return null;
  return done / window;
}

/** Forecast finish date for `remainingEffort`, or null ("Not enough history to forecast"). */
export function forecastFinish(history: CompletionPoint[], remainingEffort: number, today: string, historyStart?: string | null): string | null {
  if (remainingEffort <= 0) return today;
  const v = velocityPerDay(history, today, historyStart);
  if (v === null || v === 0) return null;
  return addDaysIso(today, Math.ceil(remainingEffort / v));
}

export type PriorityCtx = { today: string; deps: DepLite[]; byId: Map<string, TaskLite> };

/** Deterministic priority score (fallback for AI priority recommendations). */
export function priorityScore(t: TaskLite, ctx: PriorityCtx): number {
  const dueTerm = t.dueDate ? clamp(14 - daysBetween(ctx.today, t.dueDate), 0, 14) * 3 : 0;
  return (
    PRIORITY_WEIGHT[t.priority] * 30 +
    dueTerm +
    openBlockedBy(t.id, ctx.deps, ctx.byId) * 12 +
    (t.status === "in_review" ? 10 : 0) -
    (effectivelyBlocked(t, ctx.deps, ctx.byId) ? 25 : 0)
  );
}
