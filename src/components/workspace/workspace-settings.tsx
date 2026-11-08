"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWorkspace, transferOwnership, updateWorkspace } from "@/app/(app)/w/[workspaceSlug]/_actions/workspace";
import { useWorkspace } from "@/components/layout/workspace-context";
import { SettingsCard } from "@/components/settings/settings-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlugStatusMessage } from "@/components/workspace/slug-status";
import { useSlugAvailability } from "@/hooks/use-slug-availability";
import { ROLE_LABELS } from "@/lib/domain";

export function WorkspaceSettings({ members }: { members: { user_id: string; role: string; full_name: string }[] }) {
  const { workspace, role } = useWorkspace();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const slugStatus = useSlugAvailability(slug === workspace.slug ? "" : slug);
  const [transferTo, setTransferTo] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const isAdmin = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  if (!isAdmin) {
    return (
      <SettingsCard title="Workspace" description="Only owners and admins can change workspace settings.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{workspace.name}</dd></div>
          <div><dt className="text-muted-foreground">URL</dt><dd className="font-tabular">/w/{workspace.slug}</dd></div>
          <div><dt className="text-muted-foreground">Your role</dt><dd>{ROLE_LABELS[role]}</dd></div>
        </dl>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5" aria-hidden /> Read-only</p>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await updateWorkspace({ workspaceId: workspace.id, name, slug });
            if (!res.ok) {
              toast.error(res.error.message);
              return;
            }
            toast.success("Saved");
            if (res.data.slug !== workspace.slug) router.replace(`/w/${res.data.slug}/settings`);
            else router.refresh();
          });
        }}
      >
        <SettingsCard
          title="General"
          footer={<Button type="submit" disabled={pending || (name === workspace.name && slug === workspace.slug) || slugStatus.state === "taken"}>Save</Button>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">URL</span>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={40} spellCheck={false} />
              <SlugStatusMessage status={slugStatus} onUseSuggestion={setSlug} />
              <span className="block text-xs text-muted-foreground">Changing the URL breaks old links to this workspace.</span>
            </label>
          </div>
        </SettingsCard>
      </form>

      {isOwner ? (
        <SettingsCard title="Danger zone" tone="danger" description="These actions affect everyone in the workspace.">
          <div className="space-y-2">
            <p className="text-sm font-medium">Transfer ownership</p>
            <div className="flex flex-wrap gap-2">
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="h-8 w-60" aria-label="New owner"><SelectValue placeholder="Choose a member…" /></SelectTrigger>
                <SelectContent>
                  {members.filter((m) => m.role !== "owner" && m.role !== "guest").map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.full_name} ({ROLE_LABELS[m.role as "member"]})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!transferTo || pending}
                onClick={() => {
                  if (!window.confirm("Transfer ownership? You'll become an admin.")) return;
                  start(async () => {
                    const res = await transferOwnership({ workspaceId: workspace.id, userId: transferTo });
                    if (!res.ok) {
                      toast.error(res.error.message);
                      return;
                    }
                    toast.success("Ownership transferred");
                    router.refresh();
                  });
                }}
              >
                Transfer
              </Button>
            </div>
          </div>
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Delete workspace</p>
            <p className="text-sm text-muted-foreground">All projects become inaccessible to every member.</p>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete workspace</Button>
          </div>
        </SettingsCard>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); setConfirm(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {workspace.name}?</DialogTitle>
            <DialogDescription>Type <span className="font-tabular font-semibold">{workspace.slug}</span> to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Workspace URL to confirm" autoComplete="off" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={confirm !== workspace.slug || pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteWorkspace({ workspaceId: workspace.id, confirmSlug: confirm });
                  if (res && !res.ok) toast.error(res.error.message);
                })
              }
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
