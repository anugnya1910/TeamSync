"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createProject } from "@/app/(app)/w/[workspaceSlug]/_actions/project";
import { ColorDot } from "@/components/common/visuals";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createClient } from "@/lib/supabase/client";
import { suggestProjectKey } from "@/lib/utils/task-key";
import { COLOR_TOKENS, createProjectSchema } from "@/lib/validation/phase2";
import { cn } from "@/lib/utils";

export const TEMPLATES = [
  { id: "blank", name: "Blank", desc: "Start from an empty board.", preview: [] as string[] },
  { id: "college_project", name: "College Project", desc: "Research → Build → Test → Report", preview: ["Research (4 tasks)", "Build (4)", "Test (4)", "Report (4)"] },
  { id: "event_planning", name: "Event Planning", desc: "Plan → Promote → Execute → Wrap-up", preview: ["Plan (4 tasks)", "Promote (3)", "Execute (3)", "Wrap-up (3)"] },
] as const;

const EMOJI = ["", "🚀", "📚", "🎓", "🧪", "🛠️", "🎉", "📈", "💡", "🎨", "📱", "🌱"];

function useKeyAvailable(workspaceId: string, key: string) {
  const k = useDebouncedValue(key, 300);
  return useQuery({
    queryKey: ["project-key", workspaceId, k],
    enabled: /^[A-Z]{2,5}$/.test(k),
    queryFn: async () => {
      const { data, error } = await createClient().rpc("is_project_key_available", { p_workspace: workspaceId, p_key: k });
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function NewProjectDialog({
  open,
  onOpenChange,
  teams = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams?: { id: string; name: string }[];
}) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<(typeof COLOR_TOKENS)[number]>("indigo");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [teamId, setTeamId] = useState("");
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("blank");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const avail = useKeyAvailable(workspace.id, key);

  const reset = () => {
    setName(""); setKey(""); setKeyTouched(false); setDescription(""); setIcon(""); setColor("indigo");
    setVisibility("workspace"); setStartDate(""); setTargetDate(""); setTeamId(""); setTemplate("blank"); setErrors({});
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { workspaceId: workspace.id, name, key, description, icon, color, visibility, startDate, targetDate, teamId, template };
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    if (avail.data === false) {
      setErrors({ key: "That key is already used in this workspace." });
      return;
    }
    start(async () => {
      const res = await createProject(input);
      if (!res.ok) {
        setErrors(Object.fromEntries(Object.entries(res.error.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""])));
        toast.error(res.error.message);
        return;
      }
      toast.success("Project created");
      onOpenChange(false);
      reset();
      router.push(`/w/${workspace.slug}/p/${res.data.key}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Projects hold milestones and tasks. You&apos;ll be the project lead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <FormField label="Name" error={errors.name}>
              {(c) => (
                <Input {...c} autoFocus value={name} maxLength={80} onChange={(e) => { setName(e.target.value); if (!keyTouched) setKey(suggestProjectKey(e.target.value)); }} />
              )}
            </FormField>
            <FormField label="Key" error={errors.key} description="Task IDs look like KEY-1">
              {(c) => (
                <div className="space-y-1">
                  <Input {...c} value={key} maxLength={5} className="font-tabular uppercase" onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }} />
                  {/^[A-Z]{2,5}$/.test(key) && avail.data !== undefined ? (
                    avail.data ? (
                      <p className="flex items-center gap-1 text-xs text-success-text" aria-live="polite"><CircleCheck className="size-3" aria-hidden /> Available</p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-danger-text" aria-live="polite"><CircleAlert className="size-3" aria-hidden /> Taken</p>
                    )
                  ) : null}
                </div>
              )}
            </FormField>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium" id="icon-label">Icon</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-labelledby="icon-label">
                {EMOJI.map((em) => (
                  <button key={em || "none"} type="button" role="radio" aria-checked={icon === em} aria-label={em || "No icon"} onClick={() => setIcon(em)} className={cn("grid size-8 place-items-center rounded-md border text-base", icon === em ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    {em || <span className="text-xs text-muted-foreground">—</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium" id="color-label">Colour</span>
              <div className="flex gap-1" role="radiogroup" aria-labelledby="color-label">
                {COLOR_TOKENS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={cn("grid size-8 place-items-center rounded-md border", color === c && "border-primary ring-2 ring-primary/30")}>
                    <ColorDot color={c} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FormField label="Description" description="Optional · markdown">
            {(c) => <Textarea {...c} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} className="min-h-20" />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Start date">{(c) => <Input {...c} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}</FormField>
            <FormField label="Target date" error={errors.targetDate}>{(c) => <Input {...c} type="date" value={targetDate} min={startDate || undefined} onChange={(e) => setTargetDate(e.target.value)} />}</FormField>
            <FormField label="Visibility">
              {(c) => (
                <Select value={visibility} onValueChange={(v) => setVisibility(v as "workspace" | "private")}>
                  <SelectTrigger id={c.id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workspace">Workspace — everyone can view</SelectItem>
                    <SelectItem value="private">Private — project members only</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField label="Team" description="Team members join as contributors">
              {(c) => (
                <Select value={teamId || "none"} onValueChange={(v) => setTeamId(v === "none" ? "" : v)}>
                  <SelectTrigger id={c.id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Template</legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Template">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)} className={cn("rounded-xl border p-3 text-left", template === t.id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.desc}</span>
                  {t.preview.length ? <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">{t.preview.map((p) => <li key={p}>◆ {p}</li>)}</ul> : null}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Templates create milestone and task titles only — no dates or fake progress.</p>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Creating…">Create project</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
