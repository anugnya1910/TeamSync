"use client";

import { Diamond, Flag } from "lucide-react";
import { PulseCard, TopRisks, type TrendPoint } from "@/components/pulse/pulse-card";
import { ExplainRisksButton, PlanDialog } from "@/components/ai/ai-dialogs";
import type { PulseResult } from "@/lib/algorithms/pulse";
import type { Risk } from "@/lib/algorithms/risk";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { updateProject } from "@/app/(app)/w/[workspaceSlug]/_actions/project";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { EmptyState } from "@/components/brand/empty-state";
import { Markdown } from "@/components/common/markdown";
import { UserAvatar } from "@/components/common/visuals";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { PROJECT_ROLE_LABELS } from "@/lib/domain";
import { qk } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import { useProject } from "./project-context";

/** Progress = done effort ÷ total effort of the milestone's non-cancelled tasks (§B.6); null if none. */
export function milestoneProgress(tasks: { milestone_id: string | null; status: string; effort_points: number | null; parent_task_id: string | null }[], milestoneId: string) {
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.milestone_id !== milestoneId || t.status === "cancelled" || t.parent_task_id) continue;
    const e = t.effort_points ?? 1;
    total += e;
    if (t.status === "done") done += e;
  }
  return total === 0 ? null : { pct: Math.round((done / total) * 100), done, total };
}

export type OverviewIntel = {
  pulse: PulseResult;
  risks: Risk[];
  taskKeyById: Record<string, string>;
  forecasts: Record<string, { forecast: string | null; remaining: number; late: boolean | null }>;
  trend: TrendPoint[];
  updatedAt: string;
};

export function ProjectOverview({ intel, aiSlot }: { intel: OverviewIntel; aiSlot?: React.ReactNode }) {
  const { project, milestones, members, permissions, basePath } = useProject();
  const router = useRouter();
  const { data: tasks = [] } = useProjectTasks(project.id);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(project.description ?? "");
  const people = useMemo(() => new Map(members.map((m) => [m.user_id, m.profile])), [members]);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <section aria-labelledby="about-h" className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="about-h" className="text-card-title">About</h2>
            <div className="flex items-center gap-2">
              {permissions.canEditProject && aiSlot ? (
                <PlanDialog projectId={project.id} startDate={project.start_date ?? new Date().toISOString().slice(0, 10)} />
              ) : null}
              {permissions.canEditProject && !editing ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              ) : null}
            </div>
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={10000} className="min-h-32" aria-label="Project description (markdown)" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setDesc(project.description ?? ""); setEditing(false); }}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await updateProject({
                      projectId: project.id,
                      name: project.name,
                      description: desc,
                      icon: project.icon ?? "",
                      color: project.color as "indigo",
                      visibility: project.visibility,
                      status: project.status,
                      startDate: project.start_date,
                      targetDate: project.target_date,
                    });
                    if (!res.ok) return toast.error(res.error.message);
                    toast.success("Saved");
                    setEditing(false);
                    router.refresh();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : project.description ? (
            <Markdown>{project.description}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Open tasks</dt><dd className="font-tabular font-semibold">{open}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Total tasks</dt><dd className="font-tabular font-semibold">{tasks.length}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Start</dt><dd>{project.start_date ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Target</dt><dd>{project.target_date ?? "—"}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="ms-h" className="rounded-2xl border bg-card p-5">
          <h2 id="ms-h" className="text-card-title mb-3">Milestones</h2>
          {milestones.length ? (
            <ol className="space-y-4">
              {milestones.map((m) => {
                const p = milestoneProgress(tasks, m.id);
                return (
                  <li key={m.id} className="flex gap-3">
                    <Diamond className={m.status === "completed" ? "mt-0.5 size-4 shrink-0 fill-success text-success" : "mt-0.5 size-4 shrink-0 text-accent-text"} aria-hidden />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.due_date ? `due ${m.due_date}` : "no due date"}</span>
                        {m.status === "completed" ? <span className="text-xs text-success-text">Completed</span> : null}
                      </div>
                      {m.status === "open" && m.due_date ? (
                        <p className={intel.forecasts[m.id]?.late ? "text-xs font-medium text-danger-text" : "text-xs text-muted-foreground"}>
                          {intel.forecasts[m.id]?.forecast
                            ? `Forecast: ${intel.forecasts[m.id]!.forecast}${intel.forecasts[m.id]!.late ? ` · late (due ${m.due_date})` : " · on track"}`
                            : "Forecast: not enough history yet"}
                        </p>
                      ) : null}
                      {p ? (
                        <div className="flex items-center gap-2">
                          <Progress value={p.pct} className="h-1.5" aria-label={`${m.name} progress`} />
                          <span className="font-tabular text-xs text-muted-foreground">{p.pct}% · {p.done}/{p.total} pts</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No tasks in this milestone yet.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={Flag} title="No milestones" description={permissions.canEditProject ? "Add milestones in project Settings to group tasks into phases." : "The project lead hasn't added milestones yet."} compact as="h3" />
          )}
        </section>

        <section aria-labelledby="act-h" className="rounded-2xl border bg-card p-5">
          <h2 id="act-h" className="text-card-title mb-3">Recent activity</h2>
          <ActivityFeed scope={{ kind: "project", id: project.id }} queryKey={qk.projectActivity(project.id)} people={people} limit={15} />
        </section>
      </div>

      <aside className="space-y-6">
        <PulseCard pulse={intel.pulse} basePath={basePath} updatedAt={intel.updatedAt} trend={intel.trend} />
        <TopRisks risks={intel.risks} taskKeyById={intel.taskKeyById} basePath={basePath}>
          {aiSlot ? <ExplainRisksButton projectId={project.id} /> : null}
        </TopRisks>
        {aiSlot}
        <section aria-labelledby="members-h" className="rounded-2xl border bg-card p-5">
          <h2 id="members-h" className="text-card-title mb-3">Members</h2>
          <ul className="space-y-2.5">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 text-sm">
                <UserAvatar name={m.profile.full_name} url={m.profile.avatar_url} className="size-7" />
                <span className="min-w-0 flex-1 truncate">{m.profile.full_name}</span>
                <span className="text-xs text-muted-foreground">{PROJECT_ROLE_LABELS[m.role]}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
