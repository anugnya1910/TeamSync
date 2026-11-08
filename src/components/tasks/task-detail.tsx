"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, CopyPlus, Link2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createTask, deleteTask, duplicateTask, restoreTask, setAssignees, setLabels } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { StatusIcon } from "@/components/brand/status-icon";
import { Markdown } from "@/components/common/markdown";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMoveTask } from "@/hooks/use-move-task";
import { useProjectTasks, useUpdateTask, type BoardTask } from "@/hooks/use-project-tasks";
import type { TaskStatus } from "@/lib/domain";
import { canDeleteTask } from "@/lib/permissions";
import { qk } from "@/lib/query-keys";
import { BlockedDialog } from "./blocked-dialog";
import { AssigneePicker, EffortSelect, LabelPicker, MilestoneSelect, PrioritySelect, StatusSelect } from "./pickers";
import { TaskAttachments } from "./task-attachments";
import { TaskComments } from "./task-comments";
import { TaskDependencies } from "./task-dependencies";
import { BreakdownDialog } from "@/components/ai/ai-dialogs";

function Prop({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Description editor: Write/Preview with autosave (debounce 600 ms) and a "Saved" indicator (§F.7). */
function DescriptionEditor({ task, canEdit, onSave }: { task: BoardTask; canEdit: boolean; onSave: (v: string | null) => Promise<void> }) {
  const { members } = useProject();
  const [value, setValue] = useState(task.description ?? "");
  const [mode, setMode] = useState<"preview" | "write">(task.description ? "preview" : "write");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | undefined>(undefined);
  const lastSaved = useRef(task.description ?? "");

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const schedule = (v: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      if (v === lastSaved.current) return;
      setStatus("saving");
      await onSave(v.trim() ? v : null);
      lastSaved.current = v;
      setStatus("saved");
    }, 600);
  };

  return (
    <section aria-labelledby="desc-h" className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 id="desc-h" className="text-sm font-semibold">
          Description
        </h3>
        {canEdit ? (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status === "saving" ? "Saving…" : status === "saved" ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3" aria-hidden /> Saved
                </span>
              ) : null}
            </span>
            <Button variant="ghost" size="xs" onClick={() => setMode(mode === "write" ? "preview" : "write")}>
              {mode === "write" ? "Preview" : "Edit"}
            </Button>
          </div>
        ) : null}
      </div>
      {canEdit && mode === "write" ? (
        <Textarea
          value={value}
          aria-label="Task description (markdown)"
          placeholder="Add details, acceptance criteria, links… (markdown)"
          className="min-h-32"
          maxLength={20000}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
            schedule(e.target.value);
          }}
          onBlur={() => {
            window.clearTimeout(timer.current);
            if (value !== lastSaved.current) {
              setStatus("saving");
              void onSave(value.trim() ? value : null).then(() => {
                lastSaved.current = value;
                setStatus("saved");
              });
            }
          }}
        />
      ) : value.trim() ? (
        <Markdown mentionHandles={members.map((m) => m.profile.handle)}>{value}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">No description.</p>
      )}
    </section>
  );
}

function Subtasks({ parent, tasks, canEdit }: { parent: BoardTask; tasks: BoardTask[]; canEdit: boolean }) {
  const { project } = useProject();
  const qc = useQueryClient();
  const subs = tasks.filter((t) => t.parent_task_id === parent.id).sort((a, b) => a.number - b.number);
  const update = useUpdateTask(project.id);
  const [title, setTitle] = useState("");
  const done = subs.filter((s) => s.status === "done").length;
  if (parent.parent_task_id) return null; // one level only

  return (
    <section aria-labelledby="subtasks-h" className="space-y-2">
      <h3 id="subtasks-h" className="text-sm font-semibold">
        Subtasks {subs.length ? <span className="font-normal text-muted-foreground">· {done}/{subs.length} done</span> : null}
      </h3>
      {subs.length ? (
        <ul className="space-y-1">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={s.status === "done"}
                disabled={!canEdit}
                aria-label={`Mark ${project.key}-${s.number} ${s.status === "done" ? "not done" : "done"}`}
                onCheckedChange={(v) => update.mutate({ id: s.id, patch: { status: v ? "done" : "todo" } })}
              />
              <span className="font-tabular text-xs text-muted-foreground">
                {project.key}-{s.number}
              </span>
              <span className={s.status === "done" ? "text-muted-foreground line-through" : ""}>{s.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const t = title.trim();
            if (!t) return;
            setTitle("");
            const res = await createTask({ projectId: project.id, title: t, parentTaskId: parent.id, milestoneId: parent.milestone_id });
            if (!res.ok) toast.error(res.error.message);
            void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a subtask…" aria-label="New subtask title" className="h-8" maxLength={200} />
          <Button type="submit" size="sm" variant="outline" disabled={!title.trim()}>
            <Plus className="size-3.5" aria-hidden /> Add
          </Button>
        </form>
      ) : null}
    </section>
  );
}

export function TaskDetail({ number, onClosed }: { number: number; onClosed?: () => void }) {
  const { project, members, milestones, labels, permissions, memberById } = useProject();
  const { user, workspace } = useWorkspace();
  const qc = useQueryClient();
  const { data: tasks, isPending } = useProjectTasks(project.id);
  const task = tasks?.find((t) => t.number === number);
  const update = useUpdateTask(project.id);
  const { move, blocked, clearBlocked } = useMoveTask(project.id);
  const [title, setTitle] = useState<string | null>(null);

  if (isPending) return <p className="p-6 text-sm text-muted-foreground">Loading task…</p>;
  if (!task) return <p className="p-6 text-sm text-muted-foreground">This task doesn&apos;t exist or was deleted.</p>;

  const key = `${project.key}-${task.number}`;
  const canEdit = permissions.canEditTasks;
  const people = new Map(members.map((m) => [m.user_id, m.profile]));
  const refreshTasks = () => void qc.invalidateQueries({ queryKey: qk.projectTasks(project.id) });
  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) => update.mutate({ id: task.id, patch: p });

  const changeStatus = (s: TaskStatus) => {
    const col = (tasks ?? []).filter((t) => t.status === s && t.id !== task.id).sort((a, b) => a.position - b.position);
    void move(task.id, s, col.length ? col[col.length - 1]!.position : null, null);
  };

  return (
    <article className="space-y-6" aria-labelledby="task-title">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={task.status} />
          <button
            type="button"
            className="font-tabular text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard?.writeText(key);
              toast.success(`Copied ${key}`);
            }}
            aria-label={`Copy task key ${key}`}
          >
            {key} <Copy className="ml-0.5 inline size-3" aria-hidden />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Task actions">
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}/w/${workspace.slug}/t/${key}`);
                  toast.success("Link copied");
                }}
              >
                <Link2 className="size-4" aria-hidden /> Copy link
              </DropdownMenuItem>
              {canEdit ? (
                <DropdownMenuItem
                  onSelect={async () => {
                    const res = await duplicateTask(task.id);
                    if (!res.ok) return toast.error(res.error.message);
                    refreshTasks();
                    toast.success(`Duplicated as ${project.key}-${res.data.number}`);
                  }}
                >
                  <CopyPlus className="size-4" aria-hidden /> Duplicate
                </DropdownMenuItem>
              ) : null}
              {canDeleteTask(permissions, task.created_by, user.id) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => {
                      const res = await deleteTask(task.id);
                      if (!res.ok) return toast.error(res.error.message);
                      refreshTasks();
                      onClosed?.();
                      toast(`Deleted ${key}`, {
                        duration: 5000,
                        action: {
                          label: "Undo",
                          onClick: async () => {
                            const r = await restoreTask(task.id);
                            if (r.ok) refreshTasks();
                            else toast.error(r.error.message);
                          },
                        },
                      });
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {canEdit ? (
          <Textarea
            id="task-title"
            value={title ?? task.title}
            aria-label="Task title"
            rows={1}
            maxLength={200}
            className="min-h-0 resize-none border-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-input dark:bg-transparent"
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
            onBlur={() => {
              const t = (title ?? task.title).trim();
              if (t && t !== task.title) patch({ title: t });
              setTitle(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        ) : (
          <h2 id="task-title" className="text-xl font-semibold">
            {task.title}
          </h2>
        )}
      </header>

      <section aria-label="Properties" className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-6">
        <Prop label="Status" htmlFor="p-status">
          <StatusSelect id="p-status" value={task.status} onChange={changeStatus} disabled={!canEdit} />
        </Prop>
        <Prop label="Priority" htmlFor="p-priority">
          <PrioritySelect id="p-priority" value={task.priority} onChange={(v) => patch({ priority: v })} disabled={!canEdit} />
        </Prop>
        <Prop label="Assignees" htmlFor="p-assignees">
          <AssigneePicker
            id="p-assignees"
            value={task.assigneeIds}
            members={members}
            disabled={!canEdit}
            onChange={async (ids) => {
              qc.setQueryData<BoardTask[]>(qk.projectTasks(project.id), (old) => old?.map((t) => (t.id === task.id ? { ...t, assigneeIds: ids } : t)));
              const res = await setAssignees({ taskId: task.id, ids });
              if (!res.ok) toast.error(res.error.message);
              refreshTasks();
            }}
          />
        </Prop>
        <Prop label="Effort" htmlFor="p-effort">
          <EffortSelect id="p-effort" value={task.effort_points} onChange={(v) => patch({ effort_points: v })} disabled={!canEdit} />
        </Prop>
        <Prop label="Start" htmlFor="p-start">
          <Input id="p-start" type="date" className="h-8" value={task.start_date ?? ""} disabled={!canEdit} onChange={(e) => patch({ start_date: e.target.value || null })} />
        </Prop>
        <Prop label="Due" htmlFor="p-due">
          <Input id="p-due" type="date" className="h-8" value={task.due_date ?? ""} disabled={!canEdit} onChange={(e) => patch({ due_date: e.target.value || null })} />
        </Prop>
        <Prop label="Milestone" htmlFor="p-ms">
          <MilestoneSelect id="p-ms" value={task.milestone_id} milestones={milestones} disabled={!canEdit} onChange={(v) => patch({ milestone_id: v })} />
        </Prop>
        <Prop label="Labels" htmlFor="p-labels">
          <LabelPicker
            id="p-labels"
            value={task.labelIds}
            labels={labels}
            disabled={!canEdit}
            onChange={async (ids) => {
              qc.setQueryData<BoardTask[]>(qk.projectTasks(project.id), (old) => old?.map((t) => (t.id === task.id ? { ...t, labelIds: ids } : t)));
              const res = await setLabels({ taskId: task.id, ids });
              if (!res.ok) toast.error(res.error.message);
              refreshTasks();
            }}
          />
        </Prop>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Switch id="p-blocked" checked={task.is_blocked} disabled={!canEdit} onCheckedChange={(v) => patch({ is_blocked: v, blocked_reason: v ? task.blocked_reason : null })} />
            <label htmlFor="p-blocked" className="text-sm">
              Blocked
            </label>
            <span className="text-xs text-muted-foreground">Blocked tasks can&apos;t be completed without a lead override.</span>
          </div>
          {task.is_blocked ? (
            <Input
              aria-label="Blocked reason"
              placeholder="Why is it blocked?"
              defaultValue={task.blocked_reason ?? ""}
              maxLength={300}
              disabled={!canEdit}
              className="h-8"
              onBlur={(e) => {
                if (e.target.value !== (task.blocked_reason ?? "")) patch({ blocked_reason: e.target.value || null });
              }}
            />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Created by {memberById.get(task.created_by ?? "")?.profile.full_name ?? "a former member"} · {new Date(task.created_at).toLocaleDateString()}
          {task.completed_at ? ` · completed ${new Date(task.completed_at).toLocaleDateString()}` : ""}
        </p>
      </section>

      <DescriptionEditor
        key={task.id}
        task={task}
        canEdit={canEdit}
        onSave={async (v) => {
          await update.mutateAsync({ id: task.id, patch: { description: v } }).catch(() => undefined);
        }}
      />

      <Subtasks parent={task} tasks={tasks ?? []} canEdit={canEdit} />
      {canEdit && workspace.aiEnabled !== false && !task.parent_task_id ? (
        <BreakdownDialog taskId={task.id} projectId={project.id} />
      ) : null}
      <TaskDependencies task={task} tasks={tasks ?? []} />
      <TaskAttachments taskId={task.id} workspaceId={workspace.id} />

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">Comments {task.commentCount ? `(${task.commentCount})` : ""}</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="pt-3">
          <TaskComments taskId={task.id} />
        </TabsContent>
        <TabsContent value="activity" className="pt-3">
          <ActivityFeed scope={{ kind: "task", id: task.id }} queryKey={qk.taskActivity(task.id)} people={people} />
        </TabsContent>
      </Tabs>

      <BlockedDialog state={blocked} onClose={clearBlocked} canOverride={permissions.canOverrideBlocked} />
    </article>
  );
}
