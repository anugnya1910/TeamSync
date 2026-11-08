"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/** Shared body for error.tsx boundaries: message, retry and a way back. */
export function RouteError({
  error,
  reset,
  backHref = "/app",
  backLabel = "Back to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  useEffect(() => {
    logger.error("route error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border bg-surface-2 text-danger-text">
        <TriangleAlert className="size-6" aria-hidden />
      </div>
      <h2 className="text-card-title">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load this page. Try again, and if it keeps happening, head back and retry
        in a moment.
        {error.digest ? <span className="mt-1 block font-tabular text-xs">Ref: {error.digest}</span> : null}
      </p>
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
