import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ params }: PageProps<"/w/[workspaceSlug]/teams">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="teams" slug={workspaceSlug} />;
}
