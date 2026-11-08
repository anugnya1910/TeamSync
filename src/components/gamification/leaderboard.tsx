import { Flame, Trophy } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { UserAvatar } from "@/components/common/visuals";
import { cn } from "@/lib/utils";

export type LeaderRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streak: number;
  tasks: number;
  rank: number | null;
  isSelf: boolean;
};

const TABS = [
  { key: "week", label: "This week" },
  { key: "month", label: "30 days" },
  { key: "all", label: "All time" },
] as const;

function Row({ r }: { r: LeaderRow }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-lg px-3 py-2", r.isSelf && "bg-surface-2 ring-1 ring-border")}>
      <span className="w-6 text-right font-tabular text-sm text-muted-foreground">{r.rank ?? "–"}</span>
      <UserAvatar name={r.name} url={r.avatarUrl} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {r.name}
          {r.isSelf ? <span className="font-normal text-muted-foreground"> (you{r.rank === null ? ", hidden from others" : ""})</span> : null}
        </span>
        <span className="text-xs text-muted-foreground">
          Level {r.level} · {r.tasks} task{r.tasks === 1 ? "" : "s"}
          {r.streak ? (
            <>
              {" · "}
              <Flame className="inline size-3 text-warning-text" aria-hidden /> {r.streak}-day streak
            </>
          ) : null}
        </span>
      </span>
      <span className="font-tabular text-sm font-semibold">{r.xp.toLocaleString()} XP</span>
    </li>
  );
}

export function Leaderboard({ rows, period }: { rows: LeaderRow[]; period: "week" | "month" | "all" }) {
  const ranked = rows.filter((r) => r.rank !== null);
  const active = ranked.filter((r) => r.xp > 0);
  const podium = active.slice(0, 3);
  const rest = ranked.slice(podium.length, 10);
  const me = rows.find((r) => r.isSelf);
  const meShown = me && (podium.includes(me) || rest.includes(me));
  // Podium order: 2nd, 1st, 3rd.
  const order = [podium[1], podium[0], podium[2]].filter((r): r is LeaderRow => Boolean(r));

  return (
    <div className="space-y-4">
      <nav aria-label="Leaderboard period" className="flex w-fit gap-1 rounded-lg border bg-card p-0.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "week" ? "?" : `?period=${t.key}`}
            aria-current={period === t.key ? "page" : undefined}
            className={cn("rounded-md px-3 py-1 text-xs font-medium", period === t.key ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {active.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={Trophy} title="No XP earned yet" description={period === "all" ? "Complete a task to earn the first XP in this workspace." : "Nobody has earned XP in this period yet — complete a task to get on the board."} />
        </div>
      ) : (
        <section aria-label="Top three" className="rounded-2xl border bg-card p-4">
          <ol className="flex items-end justify-center gap-3 sm:gap-6">
            {order.map((r) => {
              const first = r.rank === podium[0]?.rank && r === podium[0];
              return (
                <li key={r.userId} className="flex w-24 flex-col items-center text-center sm:w-32">
                  <UserAvatar name={r.name} url={r.avatarUrl} className={first ? "size-14" : "size-11"} />
                  <span className="mt-1 w-full truncate text-sm font-medium">{r.name}</span>
                  <span className="font-tabular text-xs text-muted-foreground">{r.xp.toLocaleString()} XP · L{r.level}</span>
                  <div
                    className={cn("mt-2 flex w-full items-start justify-center rounded-t-lg bg-surface-2 pt-1 font-tabular text-lg font-semibold", first ? "h-20" : r === podium[1] ? "h-14" : "h-10")}
                    aria-label={`Rank ${r.rank}`}
                  >
                    {r.rank}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {rest.length || (me && !meShown) ? (
        <section aria-label="Rankings" className="rounded-2xl border bg-card p-2">
          <ol className="space-y-0.5">
            {rest.map((r) => <Row key={r.userId} r={r} />)}
          </ol>
          {me && !meShown ? (
            <>
              {rest.length ? <div className="my-1 border-t border-dashed" aria-hidden /> : null}
              <ol aria-label="Your position">
                <Row r={me} />
              </ol>
            </>
          ) : null}
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Prefer not to be ranked? Turn off “Show me on leaderboards” in{" "}
        <Link href="/settings/preferences" className="underline">preferences</Link>. You&apos;ll still see your own XP.
      </p>
    </div>
  );
}
