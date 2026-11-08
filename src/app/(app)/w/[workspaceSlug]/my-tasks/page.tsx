import type { Metadata } from "next";
import { PhasePlaceholderPage } from "@/components/layout/phase-placeholder-page";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage({ params }: PageProps<"/w/[workspaceSlug]/my-tasks">) {
  const { workspaceSlug } = await params;
  return <PhasePlaceholderPage navKey="my-tasks" slug={workspaceSlug} />;
}
