import { addDays, addWeeks, format, isValid, parseISO, startOfWeek } from "date-fns";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Natural-language date helper for quick task entry (PHASE_2 Step 4).
 * Supports: today, tomorrow/tmr, yesterday, weekday names (+ "next <weekday>", 3-letter forms),
 * "+3d" / "+2w", "in 3 days", "next week" (start of next week), ISO dates (YYYY-MM-DD).
 * Returns an ISO date string (YYYY-MM-DD) or null when not understood.
 * `today` should be the user's local date (timezone already applied).
 */
export function parseQuickDate(input: string, today: Date, weekStartsOn: 0 | 1 = 1): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  if (raw === "today" || raw === "tod") return fmt(today);
  if (raw === "tomorrow" || raw === "tmr" || raw === "tom") return fmt(addDays(today, 1));
  if (raw === "yesterday") return fmt(addDays(today, -1));
  if (raw === "next week") return fmt(addWeeks(startOfWeek(today, { weekStartsOn }), 1));

  const rel = raw.match(/^(?:\+|in\s+)(\d{1,3})\s*(d|day|days|w|wk|week|weeks)$/);
  if (rel) {
    const n = Number(rel[1]);
    return fmt(rel[2]!.startsWith("w") ? addWeeks(today, n) : addDays(today, n));
  }

  const wd = raw.match(/^(next\s+)?([a-z]{3,9})$/);
  if (wd) {
    const idx = WEEKDAYS.findIndex((d) => d === wd[2] || d.slice(0, 3) === wd[2]);
    if (idx !== -1) {
      let diff = (idx - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // "fri" on a Friday means next Friday
      if (wd[1]) diff += diff < 7 ? 7 : 0;
      return fmt(addDays(today, diff));
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = parseISO(raw);
    return isValid(d) && fmt(d) === raw ? raw : null;
  }
  return null;
}
