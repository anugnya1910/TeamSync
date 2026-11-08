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
import type { Suggestion } from "@/lib/intelligence/suggested-next";
import { Button } from "@/components/ui/button";
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

export function MyTasks({ tasks, today, suggestions = {} }: { tasks: MyTask[]; today: string; suggestions?: Record<string, Suggestion> }) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [blocked, setBlocked] = useState<BlockedState>(null);
  const [mode, setMode] = useState<"due" | "suggested">("due");

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

  const row = (t: MyTask, showReason: boolean) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <PriorityIcon priority={t.priority} />
                  <Link href={`/w/${workspace.slug}/p/${t.project.key}/board?task=${t.project.key}-${t.number}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium hover:underline">{t.title}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ColorDot color={t.project.color} /> {t.project.name} · <span className="font-tabular">{t.project.key}-{t.number}</span>
                      {t.due_date ? ` · due ${t.due_date}` : ""}
                    </span>
                  </Link>
                  {showReason && suggestions[t.id] ? <span className="w-full text-xs text-muted-foreground sm:order-last">Why: {suggestions[t.id]!.reason}</span> : null}
                  <div className="w-40">
                    <StatusSelect value={t.status} onChange={(s) => void change(t, s)} disabled={!t.canEdit} />
                  </div>
                </li>
  );
  const ranked = [...tasks].sort((a, b) => (suggestions[b.id]?.score ?? 0) - (suggestions[a.id]?.score ?? 0) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  return (
    <div className="space-y-6">
      <div className="flex w-fit gap-1 rounded-lg border bg-card p-0.5" role="group" aria-label="Order tasks">
        <Button size="xs" variant={mode === "due" ? "secondary" : "ghost"} aria-pressed={mode === "due"} onClick={() => setMode("due")}>By due date</Button>
        <Button size="xs" variant={mode === "suggested" ? "secondary" : "ghost"} aria-pressed={mode === "suggested"} onClick={() => setMode("suggested")}>Suggested next</Button>
      </div>
      {mode === "suggested" ? (
        <section aria-labelledby="b-suggested">
          <h2 id="b-suggested" className="mb-1 text-sm font-semibold">Suggested next</h2>
          <p className="mb-2 text-xs text-muted-foreground">Ranked by priority, how soon it&apos;s due, how many tasks it unblocks and whether it&apos;s in review; blocked work sinks.</p>
          <ol className="divide-y overflow-hidden rounded-xl border bg-card">{ranked.map((t) => row(t, true))}</ol>
        </section>
      ) : (
        BUCKETS.map(([key, label]) => {
          const list = tasks.filter((t) => dueBucket(t.due_date, today) === key).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
          if (!list.length) return null;
          return (
            <section key={key} aria-labelledby={`b-${key}`}>
              <h2 id={`b-${key}`} className={key === "overdue" ? "mb-2 text-sm font-semibold text-danger-text" : "mb-2 text-sm font-semibold"}>
                {label} <span className="font-tabular font-normal text-muted-foreground">{list.length}</span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">{list.map((t) => row(t, false))}</ul>
            </section>
          );
        })
      )}
      <BlockedDialog state={blocked} onClose={() => setBlocked(null)} canOverride={false} />
    </div>
  );
}
