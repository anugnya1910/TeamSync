"use client";

import { useCallback, useState } from "react";

export type AiSource = "ai" | "fallback";
export type AiResult<T> = {
  source: AiSource;
  reason?: string;
  data: T;
  remaining?: { user: number; workspace: number };
  [k: string]: unknown;
};

export const REASON_LABEL: Record<string, string> = {
  not_configured: "AI isn't configured on this server",
  disabled: "AI is turned off for this workspace",
  user_limit: "You've reached today's AI limit",
  workspace_limit: "This workspace reached today's AI limit",
  global_limit: "TeamSync's daily AI limit was reached",
  timeout: "The AI provider took too long",
  error: "The AI provider returned an error",
  invalid_output: "The AI answer didn't pass validation",
};

/** Calls /api/ai/{action}; the server always returns a usable result (AI or rules-based). */
export function useAi<T>(action: "breakdown" | "summary" | "plan-project" | "priorities" | "risks") {
  const [result, setResult] = useState<AiResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (body: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/ai/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Request failed");
          return null;
        }
        setResult(json as AiResult<T>);
        return json as AiResult<T>;
      } catch {
        setError("Network error — please try again.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );
  return { result, loading, error, run, reset: () => setResult(null) };
}
