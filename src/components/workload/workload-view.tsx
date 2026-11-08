"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, RefreshCw, Scale, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setProjectMember } from "@/app/(app)/w/[workspaceSlug]/_actions/project";
import { applyWorkloadSuggestion, dismissWorkloadSuggestion, refreshWorkloadSuggestions } from "@/app/(app)/w/[workspaceSlug]/_actions/workload";
import { EmptyState } from "@/components/brand/empty-state";
import { UserAvatar } from "@/components/common/visuals";
import { useProject } from "@/components/project/project-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OVERLOAD, UNDERUSE, type MemberStatus, type WorkloadResult } from "@/lib/algorithms/workload";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export type SavedSuggestion = {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  imbalanceBefore: number;
  imbalanceAfter: number;
  fromAfter: number | null;
  toAfter: number | null;
  createdAt: string;
};

const STATUS: Record<MemberStatus, { label: string; bar: string; text: string }> = {
  overloaded: { label: "Overloaded", bar: "bg-danger", text: "text-danger-text" },
  balanced: { label: "Balanced", bar: "bg-success", text: "text-success-text" },
  underutilized: { label: "Has room", bar: "bg-info", text: "text-info-text" },
};

const pct = (u: number) => `${Math.round(u * 100)}%`;
/** Bars scale to 150 % so overload is visible without overflowing. */
const barWidth = (u: number) => `${Math.min(100, (u / 1.5) * 100)}%`;

function CapacityEditor({ userId, role, capacity }: { userId: string; role: "lead" | "contributor" | "viewer"; capacity: number }) {
  const { project } = useProject();
  const router = useRouter();
  const [value, setValue] = useState(String(capacity));
  const [pending, start] = useTransition();
  const dirty = Number(value) !== capacity;
  const save = () =>
    start(async () => {
      const res = await setProjectMember({ projectId: project.id, userId, role, capacity: Number(value) });
      if (!res.ok) return void toast.error(res.error.message);
      toast.success("Capacity updated");
      router.refresh();
    });
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save();
      }}
    >
      <Input
        type="number"
        min={0}
        max={200}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-16 px-2 text-xs"
        aria-label="Weekly capacity in points"
      />
      {dirty ? (
        <Button type="submit" size="xs" variant="secondary" disabled={pending}>
          Save
        </Button>
      ) : null}
    </form>
  );
}

export function WorkloadView({ workload, saved, liveCount }: { workload: WorkloadResult; saved: SavedSuggestion[]; liveCount: number }) {
  const { project, memberById, permissions } = useProject();
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isLead = permissions.canEditProject;
  const name = (id: string) => memberById.get(id)?.profile.full_name ?? "Former member";

  const refresh = () =>
    start(async () => {
      const res = await refreshWorkloadSuggestions(project.id);
      if (!res.ok) return void toast.error(res.error.message);
      toast.success(res.data.count ? `${res.data.count} suggestion${res.data.count === 1 ? "" : "s"} ready` : "No reassignment would improve the balance right now.");
      router.refresh();
    });

  const act = (id: string, kind: "apply" | "dismiss") =>
    start(async () => {
      setBusyId(id);
      const res = kind === "apply" ? await applyWorkloadSuggestion(id) : await dismissWorkloadSuggestion(id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error.message);
        router.refresh();
        return;
      }
      toast.success(kind === "apply" ? "Task reassigned" : "Suggestion dismissed");
      void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
      router.refresh();
    });

  const sorted = [...workload.members].sort((a, b) => b.utilisation - a.utilisation);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="util-h" className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <h2 id="util-h" className="text-base font-semibold">Utilisation this week</h2>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <div className="flex gap-1"><dt>Imbalance index</dt><dd className="font-tabular font-semibold text-foreground">{workload.imbalanceIndex.toFixed(2)}</dd></div>
            <div className="flex gap-1"><dt>Mean</dt><dd className="font-tabular font-semibold text-foreground">{pct(workload.meanUtilisation)}</dd></div>
            <div className="flex gap-1"><dt>Unassigned open effort</dt><dd className="font-tabular font-semibold text-foreground">{workload.unassignedOpenEffort} pts</dd></div>
          </dl>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Load = open effort × priority × urgency (due soon or overdue weighs more), shared between assignees. Over {pct(OVERLOAD)} of capacity is overloaded; under {pct(UNDERUSE)} has room.
        </p>
        {sorted.length === 0 ? (
          <EmptyState icon={Scale} title="No active members" description="Add leads or contributors with a capacity above zero to see utilisation." />
        ) : (
          <ul className="mt-4 space-y-3">
            {sorted.map((m) => {
              const s = STATUS[m.status];
              const member = memberById.get(m.userId);
              return (
                <li key={m.userId} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[180px_1fr_auto]">
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={m.name} url={member?.profile.avatar_url} />
                    <span className="truncate text-sm font-medium">{m.name}</span>
                  </div>
                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <div
                      className="relative h-2.5 overflow-hidden rounded-full bg-surface-2"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={150}
                      aria-valuenow={Math.round(m.utilisation * 100)}
                      aria-label={`${m.name}: ${pct(m.utilisation)} of capacity, ${s.label.toLowerCase()}`}
                    >
                      <div className={cn("h-full rounded-full", s.bar)} style={{ width: barWidth(m.utilisation) }} />
                      <span aria-hidden className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: barWidth(1) }} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {Math.round(m.load * 10) / 10} / {m.capacity} pts · {m.openTaskCount} open task{m.openTaskCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className={cn("font-tabular text-sm font-semibold", s.text)}>{pct(m.utilisation)}</span>
                    <Badge variant="outline" className={cn("hidden sm:inline-flex", s.text)}>{s.label}</Badge>
                    {isLead && member ? <CapacityEditor userId={m.userId} role={member.role} capacity={member.weekly_capacity_points} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="sugg-h" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <h2 id="sugg-h" className="text-base font-semibold">Suggested reassignments</h2>
          {isLead ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={refresh} disabled={pending}>
              <RefreshCw className={cn("size-4", pending && !busyId && "animate-spin")} aria-hidden /> Refresh
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Only unstarted, single-assignee tasks move, and only to someone who stays under 90% afterwards. Nothing changes until a lead applies a suggestion.
        </p>
        {saved.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">
            {liveCount > 0
              ? isLead
                ? `${liveCount} possible reassignment${liveCount === 1 ? "" : "s"} found — press Refresh to review them.`
                : `${liveCount} possible reassignment${liveCount === 1 ? "" : "s"} found. A project lead can review them.`
              : "The team looks balanced — no reassignment would reduce the imbalance."}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {saved.map((r) => (
              <li key={r.id} className="space-y-2 rounded-xl border p-3">
                <p className="text-sm">
                  <span className="font-tabular text-xs text-muted-foreground">{r.taskKey}</span> <span className="font-medium">{r.taskTitle}</span>
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  {name(r.fromUserId)}
                  {r.fromAfter !== null ? <span className="font-tabular text-xs text-muted-foreground">(→ {pct(r.fromAfter)})</span> : null}
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
                  {name(r.toUserId)}
                  {r.toAfter !== null ? <span className="font-tabular text-xs text-muted-foreground">(→ {pct(r.toAfter)})</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <p className="font-tabular text-xs">
                  Imbalance {r.imbalanceBefore.toFixed(2)} → <span className="font-semibold text-success-text">{r.imbalanceAfter.toFixed(2)}</span>
                </p>
                {isLead ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act(r.id, "apply")} disabled={pending} aria-label={`Apply: move ${r.taskKey} to ${name(r.toUserId)}`}>
                      <Check className="size-4" aria-hidden /> Apply
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act(r.id, "dismiss")} disabled={pending} aria-label={`Dismiss suggestion for ${r.taskKey}`}>
                      <X className="size-4" aria-hidden /> Dismiss
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
