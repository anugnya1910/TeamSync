import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: PageProps<"/w/[workspaceSlug]/analytics">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="analytics" slug={workspaceSlug} />;
}
