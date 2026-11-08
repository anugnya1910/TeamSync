/** XP, levels and streaks — TS mirrors of the DB triggers (spec §G.3, §G.4). Tests/display only. */
import { daysBetween, addDaysIso, weekdayOf } from "./common";
import type { TaskPriority } from "@/lib/domain";

export const XP_BASE: Record<TaskPriority, number> = { urgent: 50, high: 35, medium: 20, low: 10, none: 10 };
export const DAILY_XP_CAP = 500;

export type XpInput = {
  priority: TaskPriority;
  effort: number | null;
  dueDate: string | null;
  completedDate: string;
  openBlockedByThis: number;
  assigneeCount: number;
  /** Created and completed by the same user within 5 minutes with effort ≤ 1 */
  trivial?: boolean;
  /** XP the recipient already earned today in this workspace */
  earnedToday?: number;
};

export function timingMultiplier(dueDate: string | null, completedDate: string): number {
  if (!dueDate) return 1.0;
  if (completedDate <= dueDate) return 1.25;
  if (daysBetween(dueDate, completedDate) <= 2) return 1.0;
  return 0.6; // late — still rewarded
}

/** XP each assignee receives for one completion (after split, trivial rule and daily cap). */
export function xpForCompletion(i: XpInput): { xp: number; total: number; capped: boolean } {
  if (i.trivial) return { xp: 0, total: 0, capped: false };
  const effortMult = 1 + 0.1 * Math.min(i.effort ?? 1, 8);
  const total = Math.round(XP_BASE[i.priority] * effortMult * timingMultiplier(i.dueDate, i.completedDate)) + 10 * Math.min(i.openBlockedByThis, 3);
  const each = Math.ceil(total / Math.max(1, i.assigneeCount));
  const room = Math.max(0, DAILY_XP_CAP - (i.earnedToday ?? 0));
  return { xp: Math.min(each, room), total, capped: each > room };
}

export function levelForXp(xp: number): { level: number; progress: number; nextAt: number; currentAt: number } {
  const x = Math.max(xp, 0);
  const level = Math.floor(Math.sqrt(x / 50)) + 1;
  const currentAt = 50 * (level - 1) ** 2;
  const nextAt = 50 * level ** 2;
  return { level, progress: (x - currentAt) / (nextAt - currentAt), nextAt, currentAt };
}

export type StreakState = { current: number; longest: number; lastActiveDate: string | null };

/** Applies one qualifying activity on local date `d` (spec §G.4). */
export function nextStreak(s: StreakState, d: string, opts: { weekendProtection: boolean }): StreakState {
  if (s.lastActiveDate === d) return s;
  let current: number;
  if (s.lastActiveDate === null) current = 1;
  else {
    const gap = daysBetween(s.lastActiveDate, d);
    if (gap <= 0) return s; // activity in the past never decrements
    if (gap === 1) current = s.current + 1;
    else if (opts.weekendProtection && onlyWeekendBetween(s.lastActiveDate, d)) current = s.current + 1;
    else current = 1;
  }
  return { current, longest: Math.max(s.longest, current), lastActiveDate: d };
}

/** True when every day strictly between a and b is Saturday or Sunday. */
export function onlyWeekendBetween(a: string, b: string): boolean {
  for (let day = addDaysIso(a, 1); day < b; day = addDaysIso(day, 1)) {
    const w = weekdayOf(day);
    if (w !== 0 && w !== 6) return false;
  }
  return true;
}
