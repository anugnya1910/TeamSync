import { CalendarClock, Flame, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { MyWeek } from "@/lib/intelligence/my-week";
import { cn } from "@/lib/utils";

function Delta({ now, before, unit }: { now: number; before: number; unit: string }) {
  if (now === before) return <span className="text-xs text-muted-foreground">same as last week</span>;
  const up = now > before;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", up ? "text-success-text" : "text-muted-foreground")}>
      <Icon className="size-3" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(now - before)} {unit} vs last week
    </span>
  );
}

/** Dashboard "My week" (spec §B.24): the viewer's own completions, on-time rate, streak, weekday pattern, upcoming due. */
export function MyWeekCard({ week: w, myTasksHref }: { week: MyWeek; myTasksHref: string }) {
  return (
    <section aria-labelledby="myweek-h" className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 id="myweek-h" className="text-card-title">My week</h2>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Tasks completed</dt>
          <dd className="font-tabular text-xl font-semibold">{w.thisWeek.tasks}</dd>
          <dd><Delta now={w.thisWeek.tasks} before={w.lastWeek.tasks} unit="tasks" /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Effort done</dt>
          <dd className="font-tabular text-xl font-semibold">{w.thisWeek.effort} pts</dd>
          <dd><Delta now={w.thisWeek.effort} before={w.lastWeek.effort} unit="pts" /></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">On time (4 weeks)</dt>
          <dd className="font-tabular text-xl font-semibold">{w.onTime.rate === null ? "—" : `${Math.round(w.onTime.rate * 100)}%`}</dd>
          <dd className="text-xs text-muted-foreground">{w.onTime.sample ? `${w.onTime.sample} with a due date` : "No dated tasks done yet"}</dd>
        </div>
        {w.streak ? (
          <div>
            <dt className="text-xs text-muted-foreground">Streak</dt>
            <dd className="inline-flex items-center gap-1 font-tabular text-xl font-semibold">
              <Flame className="size-4 text-warning-text" aria-hidden /> {w.streak.current} day{w.streak.current === 1 ? "" : "s"}
            </dd>
            <dd className="text-xs text-muted-foreground">Best {w.streak.longest}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs text-muted-foreground">
        {w.bestWeekday
          ? `You finish the most tasks on ${w.bestWeekday.name}s (${w.bestWeekday.tasks} in the last 90 days).`
          : `Most productive weekday: collecting data — ${w.weekdayDaysNeeded > 0 ? `${w.weekdayDaysNeeded} more day${w.weekdayDaysNeeded === 1 ? "" : "s"}` : "complete a task to start"}.`}
      </p>
      <Link href={myTasksHref} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm hover:bg-muted">
        <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
        <span>
          {w.dueNext7} due in the next 7 days
          {w.overdue ? <span className="font-semibold text-danger-text"> · {w.overdue} overdue</span> : null}
        </span>
      </Link>
    </section>
  );
}
