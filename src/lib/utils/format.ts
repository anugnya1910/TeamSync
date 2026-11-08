import { formatInTimeZone } from "date-fns-tz";

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

/** "Good morning" / "Good afternoon" / "Good evening" for the hour in `timeZone`. */
export function greetingFor(date: Date, timeZone: string): string {
  const hour = Number(formatInTimeZone(date, timeZone, "H"));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** e.g. "Sunday, 8 November" in the user's timezone. */
export function longDate(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEEE, d MMMM");
}

export function shortDate(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "d MMM yyyy");
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
