"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { moveTask } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { EmptyState } from "@/components/brand/empty-state";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { ColorDot } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import type { MyTask } from "@/lib/data/my-tasks";
import { dueBucket } from "@/lib/filters";
import { STATUS_LABELS, type TaskStatus } from "@/lib/domain";
import { StatusSelect } from "./pickers";
import { BlockedDialog, type BlockedState } from "./blocked-dialog";

const BUCKETS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "This week"],
  ["later", "Later"],
  ["none", "No date"],
] as const;

export function MyTasks({ tasks, today }: { tasks: MyTask[]; today: string }) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [blocked, setBlocked] = useState<BlockedState>(null);

  if (!tasks.length) {
    return (
      <div className="rounded-2xl border bg-card">
        <EmptyState icon={ListChecks} title="Nothing assigned to you" description="Tasks assigned to you in any project show up here, grouped by due date." primaryAction={{ label: "Browse projects", href: `/w/${workspace.slug}/projects` }} />
      </div>
    );
  }

  const change = async (t: MyTask, status: TaskStatus, override?: string) => {
    const res = await moveTask({ taskId: t.id, status, before: null, after: null, overrideReason: override ?? null });
    if (!res.ok) {
      if (res.error.code === "TASK_BLOCKED" || res.error.code === "SUBTASKS_OPEN") {
        setBlocked({ code: res.error.code, message: res.error.message, retry: (r) => { setBlocked(null); void change(t, status, r); } });
      } else toast.error(res.error.message);
      return;
    }
    toast.success(`${t.project.key}-${t.number} → ${STATUS_LABELS[status]}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {BUCKETS.map(([key, label]) => {
        const list = tasks.filter((t) => dueBucket(t.due_date, today) === key).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
        if (!list.length) return null;
        return (
          <section key={key} aria-labelledby={`b-${key}`}>
            <h2 id={`b-${key}`} className={key === "overdue" ? "mb-2 text-sm font-semibold text-danger-text" : "mb-2 text-sm font-semibold"}>
              {label} <span className="font-tabular font-normal text-muted-foreground">{list.length}</span>
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <PriorityIcon priority={t.priority} />
                  <Link href={`/w/${workspace.slug}/p/${t.project.key}/board?task=${t.project.key}-${t.number}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium hover:underline">{t.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ColorDot color={t.project.color} /> {t.project.name} · <span className="font-tabular">{t.project.key}-{t.number}</span>
                      {t.due_date ? ` · due ${t.due_date}` : ""}
                    </span>
                  </Link>
                  <div className="w-40">
                    <StatusSelect value={t.status} onChange={(s) => void change(t, s)} disabled={!t.canEdit} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <BlockedDialog state={blocked} onClose={() => setBlocked(null)} canOverride={false} />
    </div>
  );
}
