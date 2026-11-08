"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWorkspace } from "@/app/(app)/actions";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SlugStatusMessage } from "@/components/workspace/slug-status";
import { useSlugAvailability } from "@/hooks/use-slug-availability";
import { slugify } from "@/lib/utils/slug";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { useShellUi } from "./shell-ui-context";

export function CreateWorkspaceDialog() {
  const { createWorkspaceOpen, setCreateWorkspaceOpen } = useShellUi();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const status = useSlugAvailability(slug);

  const reset = () => {
    setName("");
    setSlug("");
    setTouched(false);
    setErrors({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createWorkspaceSchema.safeParse({ name, slug });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as "name" | "slug";
        next[k] ??= i.message;
      }
      setErrors(next);
      return;
    }
    if (status.state === "taken") {
      setErrors({ slug: "That workspace URL is already taken." });
      return;
    }
    start(async () => {
      const res = await createWorkspace(parsed.data);
      if (!res.ok) {
        setErrors({ slug: res.error.fieldErrors?.slug?.[0], name: res.error.fieldErrors?.name?.[0] });
        toast.error(res.error.message);
        return;
      }
      toast.success("Workspace created");
      setCreateWorkspaceOpen(false);
      reset();
      router.push(`/w/${res.data.slug}`);
    });
  };

  return (
    <Dialog
      open={createWorkspaceOpen}
      onOpenChange={(o) => {
        setCreateWorkspaceOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              Workspaces keep teams and their projects completely separate.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Name" error={errors.name}>
            {(c) => (
              <Input
                {...c}
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  if (!touched) setSlug(slugify(e.target.value));
                }}
              />
            )}
          </FormField>
          <FormField label="URL" error={errors.slug} description={`/w/${slug || "your-team"}`}>
            {(c) => (
              <div className="space-y-1.5">
                <Input
                  {...c}
                  value={slug}
                  spellCheck={false}
                  autoCapitalize="none"
                  onChange={(e) => {
                    setTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
                <SlugStatusMessage
                  status={status}
                  onUseSuggestion={(s) => {
                    setTouched(true);
                    setSlug(s);
                  }}
                />
              </div>
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateWorkspaceOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={pending} pendingLabel="Creating…">
              Create workspace
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
