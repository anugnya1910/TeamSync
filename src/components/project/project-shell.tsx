"use client";

import { Eye, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { AvatarStack, ProjectIcon, ProjectStatusPill } from "@/components/common/visuals";
import { TaskSheetController } from "@/components/tasks/task-sheet";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import type { ProjectBundle } from "@/lib/data/project";
import { cn } from "@/lib/utils";
import { ProjectProvider, useProject } from "./project-context";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "board", label: "Board" },
  { seg: "list", label: "List" },
  { seg: "calendar", label: "Calendar" },
  { seg: "dependencies", label: "Dependencies" },
  { seg: "analytics", label: "Analytics" },
  { seg: "workload", label: "Workload" },
  { seg: "settings", label: "Settings" },
] as const;

function Header() {
  const { project, basePath, permissions } = useProject();
  const { user } = useWorkspace();
  const pathname = usePathname();
  const current = pathname.slice(basePath.length).split("/")[1] ?? "";
  const { state, presence } = useProjectRealtime(
    project.id,
    { userId: user.id, name: user.fullName, avatarUrl: user.avatarUrl },
    current || "overview",
  );
  const others = presence.filter((p) => p.userId !== user.id);

  return (
    <div className="mb-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ProjectIcon icon={project.icon} color={project.color} name={project.name} className="size-10 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title truncate">{project.name}</h1>
            <ProjectStatusPill status={project.status} />
            {project.visibility === "private" ? (
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Private</span>
            ) : null}
          </div>
          <p className="font-tabular text-xs text-muted-foreground">{project.key}</p>
        </div>
        <div className="flex items-center gap-3">
          {others.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              <AvatarStack
                people={others.map((p) => ({ id: p.userId, name: p.name, url: p.avatarUrl }))}
                max={5}
                label={`Also viewing: ${others.map((p) => p.name).join(", ")}`}
              />
              <span className="hidden sm:inline">viewing</span>
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
              state === "live" ? "text-success-text" : "bg-warning/15 text-warning-text",
            )}
            role="status"
          >
            {state === "live" ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
            {state === "live" ? <span className="sr-only">Live updates on</span> : state === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        </div>
      </div>

      {permissions.readOnlyReason ? (
        <p className="flex items-center gap-2 rounded-lg border bg-surface-2 px-3 py-2 text-sm text-muted-foreground" role="note">
          <Eye className="size-4" aria-hidden /> {permissions.readOnlyReason}
        </p>
      ) : null}

      <nav aria-label="Project" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1 border-b">
          {TABS.map((t) => {
            const active = current === t.seg;
            return (
              <li key={t.seg || "overview"}>
                <Link
                  href={t.seg ? `${basePath}/${t.seg}` : basePath}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                    active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function ProjectShell({ bundle, children }: { bundle: ProjectBundle; children: ReactNode }) {
  return (
    <ProjectProvider bundle={bundle}>
      <Header />
      {children}
      <Suspense fallback={null}>
        <TaskSheetController />
      </Suspense>
    </ProjectProvider>
  );
}
