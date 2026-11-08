import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/brand/empty-state";
import { Leaderboard, type LeaderRow } from "@/components/gamification/leaderboard";
import { PageHeader } from "@/components/layout/page-header";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Leaderboard" };

const PERIODS = ["week", "month", "all"] as const;
type Period = (typeof PERIODS)[number];

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/w/[workspaceSlug]/leaderboard">) {
  const [{ workspaceSlug }, sp] = await Promise.all([params, searchParams]);
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "week";

  if (!workspace.gamification_enabled) {
    return (
      <>
        <PageHeader title="Leaderboard" />
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={Trophy} title="Gamification is off" description="A workspace admin can turn on XP, levels and streaks in workspace settings." />
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_workspace: workspace.id, p_period: period });
  if (error) throw new Error("Could not load the leaderboard.");
  const rows: LeaderRow[] = (data ?? []).map((r) => ({
    userId: r.user_id,
    name: r.full_name,
    avatarUrl: r.avatar_url,
    xp: r.xp,
    level: r.level,
    streak: r.current_streak,
    tasks: r.tasks_completed,
    rank: r.rank,
    isSelf: r.is_self,
  }));

  return (
    <>
      <PageHeader title="Leaderboard" description="XP earned from completing tasks (bonus for priority, effort and finishing on time), reviews and helpful comments." />
      <Leaderboard rows={rows} period={period} />
    </>
  );
}
