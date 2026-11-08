/** "My week" productivity insights (spec §B.24) — only the viewer's own data. Pure. */
import { addDaysIso, daysBetween, weekdayOf } from "@/lib/algorithms/common";
import { weekStartOf } from "@/lib/algorithms/analytics";

export const WEEKDAY_MIN_HISTORY_DAYS = 14;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type MyWeekInput = {
  today: string;
  weekStartsOn: 0 | 1;
  /** My completed (assigned) tasks — local completion date, effort, due date */
  completed: { date: string; effort: number | null; dueDate: string | null }[];
  /** First day I could have activity (joined the workspace), local date */
  historyStart: string;
  streak: { current: number; longest: number } | null;
  /** My open tasks' due dates (null = no due date) */
  openDue: (string | null)[];
};

export type MyWeek = {
  thisWeek: { tasks: number; effort: number };
  lastWeek: { tasks: number; effort: number };
  onTime: { rate: number | null; sample: number };
  streak: { current: number; longest: number } | null;
  bestWeekday: { name: string; tasks: number } | null;
  /** Days still needed before the weekday insight appears (0 when available) */
  weekdayDaysNeeded: number;
  dueNext7: number;
  overdue: number;
};

export function buildMyWeek(i: MyWeekInput): MyWeek {
  const start = weekStartOf(i.today, i.weekStartsOn);
  const prevStart = addDaysIso(start, -7);
  const sum = (from: string, to: string) => {
    const rows = i.completed.filter((c) => c.date >= from && c.date < to);
    return { tasks: rows.length, effort: rows.reduce((s, r) => s + (r.effort ?? 1), 0) };
  };
  const recent = i.completed.filter((c) => c.date >= addDaysIso(i.today, -27));
  const withDue = recent.filter((c) => c.dueDate);
  const historyDays = daysBetween(i.historyStart, i.today) + 1;
  const weekdayDaysNeeded = Math.max(0, WEEKDAY_MIN_HISTORY_DAYS - historyDays);

  let bestWeekday: MyWeek["bestWeekday"] = null;
  if (weekdayDaysNeeded === 0 && i.completed.length) {
    const counts = new Array<number>(7).fill(0);
    for (const c of i.completed) counts[weekdayOf(c.date)]! += 1;
    const max = Math.max(...counts);
    // Ties resolve to the earliest weekday in the user's week for stable output.
    const order = Array.from({ length: 7 }, (_, k) => (k + i.weekStartsOn) % 7);
    const idx = order.find((d) => counts[d] === max)!;
    bestWeekday = { name: WEEKDAYS[idx]!, tasks: max };
  }

  return {
    thisWeek: sum(start, addDaysIso(start, 7)),
    lastWeek: sum(prevStart, start),
    onTime: withDue.length ? { rate: withDue.filter((c) => c.date <= c.dueDate!).length / withDue.length, sample: withDue.length } : { rate: null, sample: 0 },
    streak: i.streak,
    bestWeekday,
    weekdayDaysNeeded,
    dueNext7: i.openDue.filter((d) => d !== null && d >= i.today && d <= addDaysIso(i.today, 7)).length,
    overdue: i.openDue.filter((d) => d !== null && d < i.today).length,
  };
}
