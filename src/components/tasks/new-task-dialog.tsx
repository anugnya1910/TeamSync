"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTask } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectMember } from "@/lib/data/project";
import type { TaskPriority, TaskStatus } from "@/lib/domain";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { parseQuickDate } from "@/lib/utils/quick-date";
import { AssigneePicker, EffortSelect, LabelPicker, MilestoneSelect, PrioritySelect, StatusSelect } from "./pickers";

type ProjectOption = { id: string; key: string; name: string; status: string };

function useEditableProjects(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["editable-projects", workspaceId],
    enabled,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, key, name, status")
        .eq("workspace_id", workspaceId)
        .neq("status", "archived")
        .order("name");
      const projects = (data ?? []) as ProjectOption[];
      // Keep only projects where the user can create tasks (lead/contributor; admins are leads).
      const roles = await Promise.all(projects.map((p) => supabase.rpc("can_edit_project_content", { p: p.id })));
      return projects.filter((_, i) => roles[i]?.data === true);
    },
  });
}

function useProjectMeta(projectId: string | null) {
  return useQuery({
    queryKey: ["project-meta", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const supabase = createClient();
      const [m, ms, l] = await Promise.all([
        supabase.from("project_members").select("user_id, role, weekly_capacity_points, profile:profiles!inner(id, full_name, handle, avatar_url)").eq("project_id", projectId!),
        supabase.from("milestones").select("*").eq("project_id", projectId!).order("sort_order"),
        supabase.from("labels").select("*").eq("project_id", projectId!).order("name"),
      ]);
      return { members: (m.data ?? []) as ProjectMember[], milestones: ms.data ?? [], labels: l.data ?? [] };
    },
  });
}

export function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { workspace, user } = useWorkspace();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data: projects = [], isPending: loadingProjects } = useEditableProjects(workspace.id, open);
  const currentKey = pathname.match(/\/p\/([A-Z]{2,5})/)?.[1];
  const [projectId, setProjectId] = useState<string | null>(null);
  const effectiveProject = projectId ?? projects.find((p) => p.key === currentKey)?.id ?? projects[0]?.id ?? null;
  const meta = useProjectMeta(effectiveProject);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [dueText, setDueText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(`${formatInTimeZone(new Date(), user.timezone, "yyyy-MM-dd")}T00:00:00`), [user.timezone]);
  const dueDate = dueText ? parseQuickDate(dueText, today, user.weekStart) : null;

  const reset = () => {
    setTitle(""); setDescription(""); setStatus("todo"); setPriority("none"); setAssignees([]); setLabels([]);
    setMilestone(null); setEffort(null); setDueText(""); setError(null); setProjectId(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveProject) return;
    if (!title.trim()) return setError("Title is required");
    if (dueText && !dueDate) return setError("Couldn't understand that date — try “tomorrow”, “fri”, “+3d” or 2026-12-01");
    start(async () => {
      const res = await createTask({
        projectId: effectiveProject,
        title,
        description,
        status,
        priority,
        dueDate,
        effort: effort as 1 | null,
        milestoneId: milestone,
        assigneeIds: assignees,
        labelIds: labels,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const p = projects.find((x) => x.id === effectiveProject);
      toast.success(`Created ${p?.key}-${res.data.number}`);
      void qc.invalidateQueries({ queryKey: qk.projectTasks(effectiveProject) });
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Quick-create a task in any project you can edit.</DialogDescription>
          </DialogHeader>
          {!loadingProjects && projects.length === 0 ? (
            <p className="rounded-lg border bg-surface-2 p-3 text-sm text-muted-foreground">
              You don&apos;t have edit access to any active project yet. Create a project first, or ask a lead to add you as a contributor.
            </p>
          ) : (
            <>
              <FormField label="Title" error={error ?? undefined}>
                {(c) => <Input {...c} autoFocus value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); setError(null); }} />}
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Project">
                  {(c) => (
                    <Select value={effectiveProject ?? ""} onValueChange={(v) => { setProjectId(v); setAssignees([]); setLabels([]); setMilestone(null); }}>
                      <SelectTrigger id={c.id} className="h-8 w-full"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.key} · {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField label="Due" description={dueText ? (dueDate ? `→ ${dueDate}` : "Not understood") : "e.g. tomorrow, fri, +3d"}>
                  {(c) => <Input {...c} value={dueText} onChange={(e) => setDueText(e.target.value)} placeholder="No date" className="h-8" />}
                </FormField>
                <FormField label="Status">{(c) => <StatusSelect id={c.id} value={status} onChange={setStatus} includeCancelled={false} />}</FormField>
                <FormField label="Priority">{(c) => <PrioritySelect id={c.id} value={priority} onChange={setPriority} />}</FormField>
                <FormField label="Assignees">{(c) => <AssigneePicker id={c.id} value={assignees} onChange={setAssignees} members={meta.data?.members ?? []} />}</FormField>
                <FormField label="Effort">{(c) => <EffortSelect id={c.id} value={effort} onChange={setEffort} />}</FormField>
                <FormField label="Milestone">{(c) => <MilestoneSelect id={c.id} value={milestone} onChange={setMilestone} milestones={meta.data?.milestones ?? []} />}</FormField>
                <FormField label="Labels">{(c) => <LabelPicker id={c.id} value={labels} onChange={setLabels} labels={meta.data?.labels ?? []} />}</FormField>
              </div>
              <FormField label="Description" description="Optional · markdown">
                {(c) => <Textarea {...c} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} />}
              </FormField>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Creating…" disabled={!effectiveProject}>Create task</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
