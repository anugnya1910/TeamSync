import { Award, Clock, Cpu, Diamond, Flag, Flame, LifeBuoy, Lock, MessageCircle, TrendingUp, Unlock, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  flag: Flag, "trending-up": TrendingUp, cpu: Cpu, clock: Clock, flame: Flame, zap: Zap, unlock: Unlock,
  "message-circle": MessageCircle, "life-buoy": LifeBuoy, diamond: Diamond,
};

export type AchievementItem = { code: string; name: string; description: string; icon: string; xpReward: number; unlocked: { at: string; workspace: string }[] };

/** Achievements gallery (spec §B.23): unlocked with date + workspace, locked with the rule text. */
export function AchievementsGallery({ items }: { items: AchievementItem[] }) {
  const unlockedCount = items.filter((i) => i.unlocked.length).length;
  return (
    <section aria-labelledby="ach-h" className="rounded-2xl border bg-card p-5">
      <h2 id="ach-h" className="text-base font-semibold">Achievements</h2>
      <p className="text-xs text-muted-foreground">
        {unlockedCount} of {items.length} unlocked. Achievements are earned per workspace while gamification is on there.
      </p>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {items.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const got = a.unlocked.length > 0;
          return (
            <li key={a.code} className={cn("flex gap-3 rounded-xl border p-3", !got && "border-dashed")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", got ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground")}>
                {got ? <Icon className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {a.name} <span className="font-tabular text-xs font-normal text-muted-foreground">+{a.xpReward} XP</span>
                </p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
                {got ? (
                  <p className="mt-0.5 text-xs text-success-text">
                    Unlocked {a.unlocked.map((u) => `${new Date(u.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · ${u.workspace}`).join("; ")}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="sr-only">Locked. </span>Not unlocked yet
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
