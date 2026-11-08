import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectProvider } from "@/components/project/project-context";
import { TaskDetail } from "@/components/tasks/task-detail";
import { getProjectBundle } from "@/lib/data/project";
import { getWorkspaceBySlug } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { parseTaskKey } from "@/lib/utils/task-key";

export async function generateMetadata({ params }: PageProps<"/w/[workspaceSlug]/t/[taskKey]">): Promise<Metadata> {
  const { taskKey } = await params;
  return { title: decodeURIComponent(taskKey).toUpperCase() };
}

/** Full-page task view (deep link /w/[ws]/t/KEY-n). */
export default async function TaskPage({ params }: PageProps<"/w/[workspaceSlug]/t/[taskKey]">) {
  const { workspaceSlug, taskKey } = await params;
  const parsed = parseTaskKey(decodeURIComponent(taskKey));
  if (!parsed) notFound();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const bundle = await getProjectBundle(workspace.id, parsed.projectKey);
  if (!bundle) notFound();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", bundle.project.id)
    .eq("number", parsed.number)
    .maybeSingle();
  if (!task) notFound();

  return (
    <ProjectProvider bundle={bundle}>
      <div className="mx-auto max-w-3xl">
        <Link href={`/w/${workspaceSlug}/p/${bundle.project.key}/board`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {bundle.project.name} board
        </Link>
        <div className="rounded-2xl border bg-card p-5 sm:p-8">
          <TaskDetail number={parsed.number} />
        </div>
      </div>
    </ProjectProvider>
  );
}
