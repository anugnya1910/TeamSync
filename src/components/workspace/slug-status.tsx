"use client";

import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import type { SlugStatus } from "@/hooks/use-slug-availability";

export function SlugStatusMessage({
  status,
  onUseSuggestion,
}: {
  status: SlugStatus;
  onUseSuggestion: (s: string) => void;
}) {
  switch (status.state) {
    case "checking":
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking availability…
        </p>
      );
    case "available":
      return (
        <p className="flex items-center gap-1.5 text-xs text-success-text" aria-live="polite">
          <CircleCheck className="size-3.5" aria-hidden /> Available
        </p>
      );
    case "taken":
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-danger-text" aria-live="polite">
          <CircleAlert className="size-3.5" aria-hidden /> That URL is taken.
          {status.suggestion ? (
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => onUseSuggestion(status.suggestion!)}
            >
              Use {status.suggestion}
            </button>
          ) : null}
        </p>
      );
    case "invalid":
      return (
        <p className="text-xs text-danger-text" aria-live="polite">
          Use 3–40 lowercase letters, numbers or hyphens.
        </p>
      );
    case "error":
      return (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Couldn&apos;t check availability — we&apos;ll verify when you continue.
        </p>
      );
    default:
      return null;
  }
}
