import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default async function WorkspaceSettingsPage({ params }: PageProps<"/w/[workspaceSlug]/settings">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="settings" slug={workspaceSlug} />;
}
