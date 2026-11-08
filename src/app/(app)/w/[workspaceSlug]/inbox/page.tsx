import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({ params }: PageProps<"/w/[workspaceSlug]/inbox">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="inbox" slug={workspaceSlug} />;
}
