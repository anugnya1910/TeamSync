"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { AiSourceBadge } from "./ai-badge";
import { useAi } from "./use-ai";

/** AI project summary (MVP). Never stored — generated on demand from server-computed stats. */
export function AiSummaryCard({ projectId }: { projectId: string }) {
  const { result, loading, error, run } = useAi<{ markdown: string }>("summary");
  return (
    <section aria-labelledby="ai-summary-h" className="space-y-3 rounded-2xl border border-ai/30 bg-card p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-ai-text" aria-hidden />
        <h2 id="ai-summary-h" className="text-card-title">Summary</h2>
        <Button variant="ghost" size="sm" className="ml-auto" disabled={loading} onClick={() => void run({ projectId })}>
          <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
          {result ? "Regenerate" : "Generate"}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger-text">{error}</p> : null}
      {result ? (
        <div className="space-y-2" aria-live="polite">
          <Markdown>{result.data.markdown}</Markdown>
          <AiSourceBadge result={result} />
          <p className="text-[11px] text-muted-foreground">Generated {new Date().toLocaleTimeString()} from this project&apos;s real numbers; not saved.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Get a short status update written from this project&apos;s real numbers. Only titles and computed stats are sent — never emails or files.
        </p>
      )}
    </section>
  );
}
