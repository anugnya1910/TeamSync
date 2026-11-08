"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Link2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusIcon } from "@/components/brand/status-icon";
import { useProject } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOpenTask } from "@/components/tasks/task-sheet";
import { depsKey, useProjectDeps } from "@/hooks/use-project-deps";
import type { BoardTask } from "@/hooks/use-project-tasks";
import { findPath, wouldCreateCycle } from "@/lib/algorithms/dependencies";
import { mapPgError } from "@/lib/action-result";
import { clientInsert } from "@/lib/db-insert";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

/** "Blocked by" / "Blocking" (spec §B.12) with instant client-side cycle check; DB is authoritative. */
export function TaskDependencies({ task, tasks }: { task: BoardTask; tasks: BoardTask[] }) {
  const { project, permissions } = useProject();
  const qc = useQueryClient();
  const openTask = useOpenTask();
  const { data: deps = [] } = useProjectDeps(project.id);
  const [open, setOpen] = useState<"blocker" | "blocked" | null>(null);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const keyOf = (id: string) => `${project.key}-${byId.get(id)?.number ?? "?"}`;
  const blockedBy = deps.filter((d) => d.blockedId === task.id);
  const blocking = deps.filter((d) => d.blockerId === task.id);
  const canEdit = permissions.canEditTasks;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: depsKey(project.id) });
    void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
    void qc.invalidateQueries({ queryKey: qk.taskActivity(task.id) });
  };

  const add = async (blocker: string, blocked: string) => {
    setOpen(null);
    if (wouldCreateCycle(deps, blocker, blocked)) {
      const path = findPath(deps, blocked, blocker) ?? [blocked, blocker];
      toast.error(`This would create a loop: ${[...path, blocked].map(keyOf).join(" → ")}`);
      return;
    }
    const { error } = await createClient().from("task_dependencies").insert(clientInsert("task_dependencies", { blocker_task_id: blocker, blocked_task_id: blocked }));
    if (error) {
      const m = mapPgError(error);
      toast.error(m.code === "CONFLICT" ? "That dependency already exists." : m.message);
      return;
    }
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await createClient().from("task_dependencies").delete().eq("id", id);
    if (error) return toast.error(mapPgError(error).message);
    refresh();
  };

  const candidates = (mode: "blocker" | "blocked") =>
    tasks.filter(
      (t) =>
        t.id !== task.id &&
        t.status !== "cancelled" &&
        !deps.some((d) => (mode === "blocker" ? d.blockerId === t.id && d.blockedId === task.id : d.blockerId === task.id && d.blockedId === t.id)),
    );

  const row = (depId: string, otherId: string, conflict: boolean) => {
    const o = byId.get(otherId);
    return (
      <li key={depId} className="flex items-center gap-2 text-sm">
        {o ? <StatusIcon status={o.status} /> : null}
        <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => openTask(keyOf(otherId))}>
          <span className="font-tabular text-xs text-muted-foreground">{keyOf(otherId)}</span> {o?.title ?? "Deleted task"}
        </button>
        {conflict ? (
          <span className="inline-flex items-center gap-1 text-xs text-warning-text" title="Schedule conflict">
            <AlertTriangle className="size-3.5" aria-hidden /> due after
          </span>
        ) : null}
        {canEdit ? (
          <Button variant="ghost" size="icon-xs" aria-label={`Remove dependency on ${keyOf(otherId)}`} onClick={() => void remove(depId)}>
            <X className="size-3" aria-hidden />
          </Button>
        ) : null}
      </li>
    );
  };

  const picker = (mode: "blocker" | "blocked", label: string) =>
    canEdit ? (
      <Popover open={open === mode} onOpenChange={(o) => setOpen(o ? mode : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" aria-label={label}>
            <Link2 className="size-3" aria-hidden /> Add
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tasks in this project…" />
            <CommandList>
              <CommandEmpty>No matching tasks.</CommandEmpty>
              <CommandGroup>
                {candidates(mode).slice(0, 100).map((t) => (
                  <CommandItem key={t.id} value={`${project.key}-${t.number} ${t.title}`} onSelect={() => void (mode === "blocker" ? add(t.id, task.id) : add(task.id, t.id))}>
                    <StatusIcon status={t.status} />
                    <span className="font-tabular text-xs text-muted-foreground">{project.key}-{t.number}</span>
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    ) : null;

  return (
    <section aria-labelledby="deps-h" className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 id="deps-h" className="text-sm font-semibold">Blocked by</h3>
          {picker("blocker", "Add a task that blocks this one")}
        </div>
        {blockedBy.length ? (
          <ul className="space-y-1">
            {blockedBy.map((d) => {
              const b = byId.get(d.blockerId);
              return row(d.id, d.blockerId, Boolean(b?.due_date && task.due_date && b.due_date > task.due_date));
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing blocks this task.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Blocking</h3>
          {picker("blocked", "Add a task this one blocks")}
        </div>
        {blocking.length ? (
          <ul className="space-y-1">
            {blocking.map((d) => {
              const x = byId.get(d.blockedId);
              return row(d.id, d.blockedId, Boolean(x?.due_date && task.due_date && task.due_date > x.due_date));
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">This task doesn&apos;t block anything.</p>
        )}
      </div>
    </section>
  );
}
