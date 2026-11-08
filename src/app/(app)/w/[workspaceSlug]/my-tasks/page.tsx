import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MyTasks } from "@/components/tasks/my-tasks";
import { getMyOpenTasks } from "@/lib/data/my-tasks";
import { getWorkspaceBySlug, requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage({ params }: PageProps<"/w/[workspaceSlug]/my-tasks">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const tasks = await getMyOpenTasks(workspace.id, profile.id);
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");
  return (
    <>
      <PageHeader title="My Tasks" description="Open tasks assigned to you across projects in this workspace." />
      <MyTasks tasks={tasks} today={today} />
    </>
  );
}
