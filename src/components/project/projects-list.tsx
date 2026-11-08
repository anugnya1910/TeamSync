"use client";

import { FolderKanban, LayoutGrid, Plus, Rows3 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { PulseRing } from "@/components/brand/pulse-ring";
import { AvatarStack, ProjectIcon, ProjectStatusPill, tokenColor } from "@/components/common/visuals";
import { useShellUi } from "@/components/layout/shell-ui-context";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ProjectCard } from "@/lib/data/project";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/domain";

export function progressOf(p: Pick<ProjectCard, "doneEffort" | "totalEffort">) {
  return p.totalEffort ? Math.round((p.doneEffort / p.totalEffort) * 100) : null;
}

export function ProjectsList({ projects }: { projects: ProjectCard[] }) {
  const { workspace, role } = useWorkspace();
  const { setNewProjectOpen } = useShellUi();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const view = params.get("view") === "table" ? "table" : "grid";
  const status = (params.get("status") as ProjectStatus | null) ?? null;
  const sort = params.get("sort") ?? "updated";
  const archived = params.get("archived") === "1";
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const list = projects
    .filter((p) => (!status || p.status === status) && (q ? `${p.name} ${p.key}`.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "target" ? (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999") : b.updated_at.localeCompare(a.updated_at),
    );
  const href = (p: ProjectCard) => `/w/${workspace.slug}/p/${p.key}`;
  const canCreate = role !== "guest";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Project filters">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" aria-label="Search projects" className="h-8 w-full sm:w-56" />
        <Select value={status ?? "all"} onValueChange={(v) => setParam("status", v === "all" ? null : v)}>
          <SelectTrigger className="h-8 w-36" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).filter((s) => s !== "archived").map((s) => (
              <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setParam("sort", v === "updated" ? null : v)}>
          <SelectTrigger className="h-8 w-40" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="target">Target date</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={archived} onCheckedChange={(v) => setParam("archived", v ? "1" : null)} aria-label="Show archived projects" />
          Archived
        </label>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="View">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon-sm" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setParam("view", null)}>
            <LayoutGrid className="size-4" aria-hidden />
          </Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" aria-label="Table view" aria-pressed={view === "table"} onClick={() => setParam("view", "table")}>
            <Rows3 className="size-4" aria-hidden />
          </Button>
          {canCreate ? (
            <Button size="sm" className="ml-2" onClick={() => setNewProjectOpen(true)}>
              <Plus className="size-4" aria-hidden /> New project
            </Button>
          ) : null}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={FolderKanban}
            title={projects.length ? "No projects match" : "No projects yet"}
            description={projects.length ? "Try a different search or filter." : canCreate ? "Create your first project — start blank or from the College Project / Event Planning templates." : "You'll see projects here once you're added to one."}
          >
            {!projects.length && canCreate ? <Button onClick={() => setNewProjectOpen(true)}><Plus className="size-4" aria-hidden /> New project</Button> : null}
          </EmptyState>
        </div>
      ) : view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const pct = progressOf(p);
            return (
              <li key={p.id}>
                <Link href={href(p)} className="group block overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-[var(--shadow-e2)]">
                  <span aria-hidden className="block h-1" style={{ background: tokenColor(p.color) }} />
                  <span className="block space-y-3 p-4">
                    <span className="flex items-start gap-3">
                      <ProjectIcon icon={p.icon} color={p.color} name={p.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold group-hover:underline">{p.name}</span>
                        <span className="font-tabular text-xs text-muted-foreground">{p.key}</span>
                      </span>
                      <PulseRing score={p.pulse?.score ?? null} size="xs" animated={false} />
                    </span>
                    <span className="flex items-center gap-2">
                      <ProjectStatusPill status={p.status} />
                      {p.target_date ? <span className="text-xs text-muted-foreground">Target {p.target_date}</span> : null}
                    </span>
                    {pct === null ? (
                      <span className="block text-xs text-muted-foreground">No tasks yet</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5" aria-label={`${p.name} progress`} />
                        <span className="font-tabular text-xs text-muted-foreground">{pct}%</span>
                      </span>
                    )}
                    <AvatarStack people={p.memberIds.map((m) => ({ id: m.user_id, name: m.profile.full_name, url: m.profile.avatar_url }))} max={5} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Project</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Progress</th>
                <th scope="col" className="px-3 py-2 font-medium">Members</th>
                <th scope="col" className="px-3 py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pct = progressOf(p);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={href(p)} className="flex items-center gap-2 font-medium hover:underline">
                        <ProjectIcon icon={p.icon} color={p.color} name={p.name} className="size-6 text-xs" />
                        {p.name} <span className="font-tabular text-xs text-muted-foreground">{p.key}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2"><ProjectStatusPill status={p.status} /></td>
                    <td className="px-3 py-2 font-tabular text-xs">{pct === null ? "—" : `${pct}%`}</td>
                    <td className="px-3 py-2"><AvatarStack people={p.memberIds.map((m) => ({ id: m.user_id, name: m.profile.full_name, url: m.profile.avatar_url }))} /></td>
                    <td className="px-3 py-2 text-xs">{p.target_date ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
