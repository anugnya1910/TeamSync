"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShellUi } from "./shell-ui-context";

/** Explains features that arrive in a later phase (no dead buttons). */
export function ComingSoonDialog() {
  const { comingSoon, showComingSoon } = useShellUi();
  return (
    <Dialog open={comingSoon !== null} onOpenChange={(o) => !o && showComingSoon(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid size-11 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <DialogTitle>{comingSoon?.title}</DialogTitle>
          <DialogDescription>{comingSoon?.description}</DialogDescription>
        </DialogHeader>
        {comingSoon ? (
          <Badge variant="outline" className="w-fit">
            Coming in Phase {comingSoon.phase}
          </Badge>
        ) : null}
        <DialogFooter>
          <Button onClick={() => showComingSoon(null)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
