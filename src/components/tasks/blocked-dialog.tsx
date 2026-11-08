"use client";

import { Ban } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type BlockedState = { code: "TASK_BLOCKED" | "SUBTASKS_OPEN"; message: string; retry: (reason: string) => void } | null;

/** Explains TASK_BLOCKED / SUBTASKS_OPEN; leads may override with a logged reason (spec §B.7). */
export function BlockedDialog({
  state,
  onClose,
  canOverride,
}: {
  state: BlockedState;
  onClose: () => void;
  canOverride: boolean;
}) {
  const [reason, setReason] = useState("");
  const title = state?.code === "SUBTASKS_OPEN" ? "Subtasks are still open" : "This task is blocked";
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 grid size-10 place-items-center rounded-xl bg-danger/10 text-danger-text">
            <Ban className="size-5" aria-hidden />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{state?.message}</DialogDescription>
        </DialogHeader>
        {canOverride ? (
          <div className="space-y-1.5">
            <label htmlFor="override-reason" className="text-sm font-medium">
              Override reason (logged in activity)
            </label>
            <Textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Client approved the workaround" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only the project lead can override this.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {canOverride ? (
            <Button
              disabled={reason.trim().length < 3}
              onClick={() => {
                state?.retry(reason.trim());
                setReason("");
              }}
            >
              Override and complete
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
