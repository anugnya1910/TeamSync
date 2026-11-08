"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyAiBreakdown, applyAiPlan, applyAiPriorities } from "@/app/(app)/w/[workspaceSlug]/_actions/ai";
import { PriorityIcon } from "@/components/brand/priority-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority } from "@/lib/domain";
import { qk } from "@/lib/query-keys";
import { AiSourceBadge } from "./ai-badge";
import { useAi } from "./use-ai";

const EFFORTS = [1, 2, 3, 5, 8, 13] as const;
type Sub = { title: string; effort: (typeof EFFORTS)[number] };

/** "Break down with AI": editable preview → "Create N subtasks" (nothing written before Apply). */
export function BreakdownDialog({ taskId, projectId, disabled }: { taskId: string; projectId: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Sub[]>([]);
  const [pending, start] = useTransition();
  const ai = useAi<{ subtasks: Sub[] }>("breakdown");

  const generate = async () => {
    const r = await ai.run({ taskId });
    if (r) setRows(r.data.subtasks);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-ai/40 text-ai-text"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          void generate();
        }}
      >
        <Sparkles className="size-3.5" aria-hidden /> Break down with AI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested subtasks</DialogTitle>
            <DialogDescription>Edit, remove or add rows. Nothing is created until you confirm.</DialogDescription>
          </DialogHeader>
          {ai.loading ? <p className="text-sm text-muted-foreground" role="status">Generating…</p> : null}
          {ai.error ? <p className="text-sm text-danger-text">{ai.error}</p> : null}
          {ai.result ? <AiSourceBadge result={ai.result} /> : null}
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input value={r.title} aria-label={`Subtask ${i + 1} title`} maxLength={200} className="h-8" onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Select value={String(r.effort)} onValueChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, effort: Number(v) as Sub["effort"] } : x)))}>
                  <SelectTrigger className="h-8 w-20" aria-label={`Subtask ${i + 1} effort`}><SelectValue /></SelectTrigger>
                  <SelectContent>{EFFORTS.map((e) => <SelectItem key={e} value={String(e)}>{e} pt</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove subtask ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          {rows.length < 8 && !ai.loading ? (
            <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { title: "", effort: 1 }])}>
              <Plus className="size-3.5" aria-hidden /> Add row
            </Button>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={pending || !rows.length || rows.some((r) => !r.title.trim())}
              onClick={() =>
                start(async () => {
                  const res = await applyAiBreakdown({ taskId, plan: { subtasks: rows.map((r) => ({ ...r, title: r.title.trim() })) } });
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success(`Created ${res.data.created} subtasks`);
                  void qc.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
                  setOpen(false);
                })
              }
            >
              Create {rows.length} subtask{rows.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Ranked = { taskId: string; reason: string };

/** "Recommend priorities": ranked suggestions → apply chosen priority changes. */
export function PrioritiesDialog({ projectId, currentPriority }: { projectId: string; currentPriority: Record<string, TaskPriority> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ai = useAi<{ ranked: Ranked[] }>("priorities");
  const [choice, setChoice] = useState<Record<string, TaskPriority | null>>({});
  const keys = (ai.result?.keys ?? {}) as Record<string, string>;
  const suggest = (i: number): TaskPriority => (i < 2 ? "urgent" : i < 5 ? "high" : "medium");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-ai/40 text-ai-text"
        onClick={async () => {
          setOpen(true);
          const r = await ai.run({ projectId });
          if (r) setChoice(Object.fromEntries(r.data.ranked.map((x, i) => [x.taskId, suggest(i) === currentPriority[x.taskId] ? null : suggest(i)])));
        }}
      >
        <Sparkles className="size-3.5" aria-hidden /> Recommend priorities
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>What to work on next</DialogTitle>
            <DialogDescription>Ranked suggestions with reasons. Tick the priority changes you want to apply.</DialogDescription>
          </DialogHeader>
          {ai.loading ? <p className="text-sm text-muted-foreground" role="status">Ranking…</p> : null}
          {ai.error ? <p className="text-sm text-danger-text">{ai.error}</p> : null}
          {ai.result ? <AiSourceBadge result={ai.result} /> : null}
          <ol className="space-y-2">
            {ai.result?.data.ranked.map((r, i) => {
              const target = suggest(i);
              const on = choice[r.taskId] != null;
              return (
                <li key={r.taskId} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                  <span className="font-tabular text-xs text-muted-foreground">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{keys[r.taskId] ?? "Task"}</p>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                  </div>
                  {currentPriority[r.taskId] !== target ? (
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={on} onCheckedChange={(v) => setChoice({ ...choice, [r.taskId]: v ? target : null })} aria-label={`Set ${keys[r.taskId] ?? "task"} to ${target}`} />
                      <PriorityIcon priority={target} showLabel />
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">already {target}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button
              disabled={pending || !Object.values(choice).some(Boolean)}
              onClick={() =>
                start(async () => {
                  const changes = Object.entries(choice).filter(([, v]) => v).map(([taskId, priority]) => ({ taskId, priority: priority! }));
                  const res = await applyAiPriorities({ projectId, changes });
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success(`Updated ${res.data.updated} task${res.data.updated === 1 ? "" : "s"}`);
                  void qc.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
                  setOpen(false);
                })
              }
            >
              Apply selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Explain risks": narrative + 3 actions (read-only). */
export function ExplainRisksButton({ projectId }: { projectId: string }) {
  const ai = useAi<{ narrative: string; actions: string[] }>("risks");
  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" className="text-ai-text" disabled={ai.loading} onClick={() => void ai.run({ projectId })}>
        <Sparkles className="size-3.5" aria-hidden /> {ai.loading ? "Explaining…" : "Explain risks"}
      </Button>
      {ai.error ? <p className="text-sm text-danger-text">{ai.error}</p> : null}
      {ai.result ? (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
          <p>{ai.result.data.narrative}</p>
          <ol className="list-decimal space-y-0.5 pl-5">{ai.result.data.actions.map((a) => <li key={a}>{a}</li>)}</ol>
          <AiSourceBadge result={ai.result} />
        </div>
      ) : null}
    </div>
  );
}

type PlanMilestone = { name: string; dueOffsetDays: number; tasks: { title: string; description: string; priority: TaskPriority; effort: (typeof EFFORTS)[number] }[] };

/** "Draft plan with AI" (lead): goal → preview tree → apply milestones + backlog tasks. */
export function PlanDialog({ projectId, startDate }: { projectId: string; startDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<PlanMilestone[]>([]);
  const [pending, start] = useTransition();
  const ai = useAi<{ milestones: PlanMilestone[] }>("plan-project");
  return (
    <>
      <Button variant="outline" size="sm" className="border-ai/40 text-ai-text" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" aria-hidden /> Draft plan with AI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Draft a project plan</DialogTitle>
            <DialogDescription>Describe the goal. You can review and edit the plan before anything is created.</DialogDescription>
          </DialogHeader>
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={2000} placeholder="e.g. Build a mobile app that helps students split expenses" aria-label="Project goal" />
          <Button size="sm" variant="outline" disabled={ai.loading || goal.trim().length < 5} onClick={async () => { const r = await ai.run({ projectId, goal }); if (r) setPlan(r.data.milestones); }}>
            {ai.loading ? "Drafting…" : plan.length ? "Redraft" : "Draft plan"}
          </Button>
          {ai.error ? <p className="text-sm text-danger-text">{ai.error}</p> : null}
          {ai.result ? <AiSourceBadge result={ai.result} /> : null}
          <ol className="space-y-3">
            {plan.map((m, i) => (
              <li key={i} className="space-y-1 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input value={m.name} aria-label={`Milestone ${i + 1} name`} className="h-8" onChange={(e) => setPlan(plan.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <span className="shrink-0 text-xs text-muted-foreground">+{m.dueOffsetDays} days</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove milestone ${i + 1}`} onClick={() => setPlan(plan.filter((_, j) => j !== i))}><Trash2 className="size-4" aria-hidden /></Button>
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">{m.tasks.map((t, k) => <li key={k}>{t.title} <span className="text-xs text-muted-foreground">· {t.effort} pt</span></li>)}</ul>
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={pending || !plan.length}
              onClick={() =>
                start(async () => {
                  const res = await applyAiPlan({ projectId, startDate, plan: { milestones: plan } });
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success(`Added ${res.data.milestones} milestones and ${res.data.tasks} tasks`);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Apply plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
