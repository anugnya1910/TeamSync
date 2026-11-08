import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CircleCheck,
  Circle,
  FolderKanban,
  History,
  Sparkles,
  Target,
} from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/domain";
import { getMyWorkspaces, getWorkspaceBySlug, requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { firstName, greetingFor, longDate, pluralize, shortDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage({ params }: PageProps<"/w/[workspaceSlug]">) {
  const { workspaceSlug } = await params;
  const profile = await requireProfile();
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();
  const membership = (await getMyWorkspaces()).find((w) => w.id === workspace.id);
  if (!membership) notFound();

  const supabase = await createClient();
  const { count: memberCount } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const now = new Date();
  const tz = profile.timezone;
  const checklist = [
    { done: true, label: "Create a workspace", note: null },
    { done: false, label: "Invite teammates", note: "Phase 2" },
    { done: false, label: "Create your first project", note: "Phase 2" },
    { done: false, label: "Complete a task", note: "Phase 2" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title">
          {greetingFor(now, tz)}, {firstName(profile.full_name)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{longDate(now, tz)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="ws-summary" className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <h2 id="ws-summary" className="text-card-title">
            {workspace.name}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2 p-4">
              <dt className="text-meta text-muted-foreground">Members</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{memberCount ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <dt className="text-meta text-muted-foreground">Your role</dt>
              <dd className="mt-1 text-lg font-semibold">{ROLE_LABELS[membership.role]}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-4">
              <dt className="text-meta text-muted-foreground">Created</dt>
              <dd className="mt-1 text-lg font-semibold">{shortDate(workspace.created_at, tz)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            {pluralize(memberCount ?? 0, "member")} · workspace URL{" "}
            <span className="font-tabular">/w/{workspace.slug}</span>
          </p>
        </section>

        <section aria-labelledby="getting-started" className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 id="getting-started" className="text-card-title">
              Getting started
            </h2>
            <Badge variant="outline" className="font-tabular">
              {doneCount}/{checklist.length}
            </Badge>
          </div>
          <ul className="mt-4 space-y-3">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2.5 text-sm">
                {c.done ? (
                  <CircleCheck className="size-4 text-success-text" aria-label="Done" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" aria-label="Not done" />
                )}
                <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                {c.note ? (
                  <span className="ml-auto text-xs text-muted-foreground">{c.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            icon: Target,
            title: "My focus",
            body: "Tasks due today, overdue and in progress for you will appear here once Projects ship in Phase 2.",
          },
          {
            icon: FolderKanban,
            title: "Projects",
            body: "Project cards with their Pulse health rings. Create your first project in Phase 2.",
          },
          {
            icon: History,
            title: "Recent activity",
            body: "A live feed of task, comment and membership activity across the workspace (Phase 2).",
          },
          {
            icon: Sparkles,
            title: "My week",
            body: "Your completed work, on-time rate and streak — computed only from your own history (Phase 3).",
          },
          {
            icon: CalendarClock,
            title: "Upcoming milestones",
            body: "Milestones due soon, with forecasts that flag ones at risk (Phase 2–3).",
          },
        ].map((card) => (
          <section key={card.title} className="rounded-2xl border bg-card" aria-label={card.title}>
            <EmptyState icon={card.icon} title={card.title} description={card.body} as="h2" compact />
          </section>
        ))}
      </div>
    </div>
  );
}
