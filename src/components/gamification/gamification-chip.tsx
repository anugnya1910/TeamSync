"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/layout/workspace-context";
import { subscribeToMyNotifications } from "@/components/notifications/use-notifications";
import { levelForXp } from "@/lib/algorithms/gamification";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const memberStatsKey = (workspaceId: string, userId: string) => ["member-stats", workspaceId, userId] as const;

export function useMyStats() {
  const { workspace, user } = useWorkspace();
  return useQuery({
    queryKey: memberStatsKey(workspace.id, user.id),
    enabled: workspace.gamificationEnabled !== false,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("v_member_stats")
        .select("total_xp, level, current_streak, longest_streak, tasks_completed")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function Ring({ progress }: { progress: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-0 size-8 -rotate-90" aria-hidden>
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * Math.min(1, Math.max(0, progress))} ${c}`} />
    </svg>
  );
}

/** Sidebar chip (spec §B.23): level, XP progress to next level, streak. Hidden when gamification is off. */
export function GamificationChip({ collapsed }: { collapsed?: boolean }) {
  const { workspace, user } = useWorkspace();
  const qc = useQueryClient();
  const { data } = useMyStats();
  const prevXp = useRef<number | null>(null);
  const [gain, setGain] = useState<{ n: number; id: number } | null>(null);
  const enabled = workspace.gamificationEnabled !== false;

  // Achievement toasts (and fresh stats) from the shared per-user notifications channel.
  useEffect(() => {
    if (!enabled) return;
    return subscribeToMyNotifications(user.id, (e) => {
      if (e.eventType !== "INSERT") return;
      if (e.new.type === "achievement_unlocked" && e.new.workspace_id === workspace.id) {
        toast.success(e.new.title ?? "Achievement unlocked", { description: e.new.body ?? undefined, icon: <Trophy className="size-4" aria-hidden /> });
      }
      void qc.invalidateQueries({ queryKey: memberStatsKey(workspace.id, user.id) });
    });
  }, [enabled, user.id, workspace.id, qc]);

  // "+N XP" micro-feedback when the real total goes up (not on first load).
  const xp = data?.total_xp ?? null;
  useEffect(() => {
    if (xp === null) return;
    const prev = prevXp.current;
    prevXp.current = xp;
    if (prev !== null && xp > prev) {
      const id = Date.now();
      setGain({ n: xp - prev, id });
      const t = window.setTimeout(() => setGain((g) => (g?.id === id ? null : g)), 2200);
      return () => window.clearTimeout(t);
    }
  }, [xp]);

  if (!enabled || !data) return null;
  const total = data.total_xp ?? 0;
  const lv = levelForXp(total);
  const toNext = lv.nextAt - total;
  const label = `Level ${lv.level}, ${total} XP, ${toNext} XP to level ${lv.level + 1}${data.current_streak ? `, ${data.current_streak}-day streak` : ""}`;

  return (
    <Link
      href={`/w/${workspace.slug}/leaderboard`}
      className={cn("relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted", collapsed && "justify-center px-0")}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
    >
      <span className="relative grid size-8 shrink-0 place-items-center">
        <Ring progress={lv.progress} />
        <span className="font-tabular text-[11px] font-semibold">{lv.level}</span>
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1 text-xs leading-tight">
          <span className="block font-medium">Level {lv.level}</span>
          <span className="block font-tabular text-muted-foreground">{toNext} XP to next</span>
        </span>
      )}
      {!collapsed && data.current_streak ? (
        <span className="inline-flex items-center gap-0.5 font-tabular text-xs font-semibold text-warning-text" aria-label={`${data.current_streak}-day streak`}>
          <Flame className="size-3.5" aria-hidden /> {data.current_streak}
        </span>
      ) : null}
      {gain ? (
        <span key={gain.id} role="status" className="xp-float pointer-events-none absolute -top-2 right-2 rounded bg-primary px-1.5 py-0.5 font-tabular text-[11px] font-semibold text-primary-foreground">
          +{gain.n} XP
        </span>
      ) : null}
    </Link>
  );
}
