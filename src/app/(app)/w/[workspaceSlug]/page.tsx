import type { Metadata } from "next";
import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CircleCheck, Circle, Diamond, FolderKanban, Sparkles, Target } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { StatusIcon } from "@/components/brand/status-icon";
import { ColorDot, ProjectIcon } from "@/components/common/visuals";
import { WorkspaceActivity } from "@/components/activity/workspace-activity";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ROLE_LABELS } from "@/lib/domain";
import { getMyOpenTasks } from "@/lib/data/my-tasks";
import { listProjects } from "@/lib/data/project";
import { getMyWorkspaces, getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { dueBucket } from "@/lib/filters";
import { firstName, greetingFor, longDate, pluralize, shortDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage({ params }: PageProps<"/w/[workspaceSlug]">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const membership = (await getMyWorkspaces()).find((w) => w.id === workspace.id);
  if (!membership) notFound();

  const tz = profile.timezone;
  const now = new Date();
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const in14 = format(addDays(new Date(`${today}T00:00:00`), 14), "yyyy-MM-dd");
  const supabase = await createClient();

  const [{ count: memberCount }, projects, myTasks, { data: milestones }, { count: doneCount }, { count: inviteCount }] = await Promise.all([
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
    listProjects(workspace.id),
    getMyOpenTasks(workspace.id, profile.id),
    supabase
      .from("milestones")
      .select("id, name, due_date, project:projects!inner(key, name, color, deleted_at)")
      .eq("workspace_id", workspace.id)
      .eq("status", "open")
      .gte("due_date", today)
      .lte("due_date", in14)
      .order("due_date")
      .limit(8),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "done"),
    supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);

  const focus = myTasks
    .filter((t) => t.status === "in_progress" || ["overdue", "today"].includes(dueBucket(t.due_date, today)))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 8);

  const checklist = [
    { done: true, label: "Create a workspace", href: null },
    { done: (memberCount ?? 0) > 1 || (inviteCount ?? 0) > 0, label: "Invite teammates", href: `/w/${workspace.slug}/members` },
    { done: projects.length > 0, label: "Create your first project", href: `/w/${workspace.slug}/projects` },
    { done: (doneCount ?? 0) > 0, label: "Complete a task", href: `/w/${workspace.slug}/my-tasks` },
  ];
  const doneSteps = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">
          {greetingFor(now, tz)}, {firstName(profile.full_name)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {longDate(now, tz)} · {workspace.name} · {pluralize(memberCount ?? 0, "member")} · you&apos;re {ROLE_LABELS[membership.role].toLowerCase()} · since {shortDate(workspace.created_at, tz)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="focus-h" className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Target className="size-4 text-primary" aria-hidden />
            <h2 id="focus-h" className="text-card-title">My focus</h2>
            <Link href={`/w/${workspace.slug}/my-tasks`} className="ml-auto text-xs font-medium text-primary hover:underline">All my tasks</Link>
          </div>
          {focus.length ? (
            <ul className="divide-y">
              {focus.map((t) => {
                const bucket = dueBucket(t.due_date, today);
                return (
                  <li key={t.id}>
                    <Link href={`/w/${workspace.slug}/p/${t.project.key}/board?task=${t.project.key}-${t.number}`} className="flex items-center gap-2.5 py-2 text-sm hover:underline">
                      <StatusIcon status={t.status} />
                      <PriorityIcon priority={t.priority} />
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <span className="font-tabular text-xs text-muted-foreground">{t.project.key}-{t.number}</span>
                      {bucket === "overdue" ? <Badge className="bg-danger/10 text-danger-text">Overdue</Badge> : bucket === "today" ? <Badge className="bg-warning/15 text-warning-text">Today</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Target} title="Nothing urgent" description="Tasks due today, overdue or in progress for you appear here." compact as="h3" />
          )}
        </section>

        <section aria-labelledby="getting-started" className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 id="getting-started" className="text-card-title">Getting started</h2>
            <Badge variant="outline" className="font-tabular">{doneSteps}/{checklist.length}</Badge>
          </div>
          <ul className="mt-4 space-y-3">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5 text-sm">
                {c.done ? <CircleCheck className="size-4 text-success-text" aria-label="Done" /> : <Circle className="size-4 text-muted-foreground" aria-label="Not done" />}
                {c.href && !c.done ? (
                  <Link href={c.href} className="text-primary hover:underline">{c.label}</Link>
                ) : (
                  <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="projects-h">
        <div className="mb-3 flex items-center gap-2">
          <FolderKanban className="size-4 text-primary" aria-hidden />
          <h2 id="projects-h" className="text-card-title">Projects</h2>
          <Link href={`/w/${workspace.slug}/projects`} className="ml-auto text-xs font-medium text-primary hover:underline">All projects</Link>
        </div>
        {projects.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.slice(0, 6).map((p) => {
              const pct = p.totalEffort ? Math.round((p.doneEffort / p.totalEffort) * 100) : null;
              return (
                <li key={p.id}>
                  <Link href={`/w/${workspace.slug}/p/${p.key}`} className="block space-y-3 rounded-2xl border bg-card p-4 hover:shadow-[var(--shadow-e2)]">
                    <span className="flex items-center gap-2.5">
                      <ProjectIcon icon={p.icon} color={p.color} name={p.name} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground" title="Project Pulse arrives in Phase 3">Pulse · P3</span>
                    </span>
                    {pct === null ? (
                      <span className="block text-xs text-muted-foreground">No tasks yet</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5" aria-label={`${p.name} progress`} />
                        <span className="font-tabular text-xs text-muted-foreground">{pct}%</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border bg-card">
            <EmptyState icon={FolderKanban} title="Create your first project" description="Use the + next to Projects in the sidebar, or press N then P. Templates: College Project, Event Planning." compact />
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="activity-h" className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 id="activity-h" className="text-card-title mb-3">Recent activity</h2>
          <WorkspaceActivity />
        </section>
        <div className="space-y-4">
          <section aria-labelledby="ms-h" className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              <h2 id="ms-h" className="text-card-title">Upcoming milestones</h2>
            </div>
            {milestones?.filter((m) => !m.project.deleted_at).length ? (
              <ul className="space-y-2.5">
                {milestones.filter((m) => !m.project.deleted_at).map((m) => (
                  <li key={m.id}>
                    <Link href={`/w/${workspace.slug}/p/${m.project.key}`} className="flex items-center gap-2 text-sm hover:underline">
                      <Diamond className="size-3.5 shrink-0 text-accent-text" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><ColorDot color={m.project.color} /> {m.due_date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No milestones due in the next 14 days.</p>
            )}
          </section>
          <section aria-label="My week" className="rounded-2xl border bg-card">
            <EmptyState icon={Sparkles} title="My week" description="Completed work, on-time rate and streaks from your own history arrive in Phase 3." compact as="h2" />
          </section>
        </div>
      </div>
    </div>
  );
}
