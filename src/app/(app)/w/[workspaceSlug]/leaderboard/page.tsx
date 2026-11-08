import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ params }: PageProps<"/w/[workspaceSlug]/leaderboard">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="leaderboard" slug={workspaceSlug} />;
}
