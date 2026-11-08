import "server-only";
import type { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { callGemini, geminiConfigured } from "./gemini";
import { SYSTEM_RULES } from "./prompts";
import { numbersAreGrounded, type AiAction } from "./schemas";

export type AiReason =
  | "not_configured"
  | "disabled"
  | "user_limit"
  | "workspace_limit"
  | "global_limit"
  | "timeout"
  | "error"
  | "invalid_output";

export type AiResponse<T> = {
  source: "ai" | "fallback";
  reason?: AiReason;
  data: T;
  remaining?: { user: number; workspace: number };
};

export const REASON_TEXT: Record<AiReason, string> = {
  not_configured: "AI isn't configured on this server",
  disabled: "AI is turned off for this workspace",
  user_limit: "You've reached today's AI limit",
  workspace_limit: "This workspace reached today's AI limit",
  global_limit: "The daily AI limit for TeamSync was reached",
  timeout: "The AI provider took too long",
  error: "The AI provider returned an error",
  invalid_output: "The AI answer didn't pass validation",
};

/**
 * Orchestrator (spec §C.7): quota → key → provider (8 s) → zod + grounding check → log.
 * Any failure returns the deterministic fallback, labelled with the reason.
 */
export async function runAiAction<T>(opts: {
  supabase: ServerSupabaseClient;
  workspaceId: string;
  action: AiAction;
  prompt: string;
  schema: z.ZodType<T>;
  fallback: () => T;
  /** For text outputs: numbers allowed to appear (grounding check) */
  groundNumbers?: (data: T) => { text: string; allowed: (number | string)[] } | null;
  /** Extra semantic validation (e.g. task ids must exist) */
  validate?: (data: T) => boolean;
}): Promise<AiResponse<T>> {
  const { supabase, workspaceId, action } = opts;
  const fallback = (reason: AiReason, remaining?: AiResponse<T>["remaining"]): AiResponse<T> => ({ source: "fallback", reason, data: opts.fallback(), remaining });

  if (!geminiConfigured()) {
    await supabase.rpc("log_ai_fallback", { p_workspace: workspaceId, p_action: action, p_status: "not_configured" });
    return fallback("not_configured");
  }

  const { data: global } = await supabase.rpc("ai_requests_today_global");
  if ((global ?? 0) >= serverEnv.AI_GLOBAL_DAILY_LIMIT) {
    await supabase.rpc("log_ai_fallback", { p_workspace: workspaceId, p_action: action, p_status: "rate_limited" });
    return fallback("global_limit");
  }

  const { data: quotaRows, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_workspace: workspaceId, p_action: action });
  const quota = quotaRows?.[0];
  if (quotaError || !quota) return fallback("error");
  const remaining = { user: quota.user_remaining, workspace: quota.workspace_remaining };
  if (!quota.allowed) return fallback((quota.reason as AiReason) ?? "error", remaining);

  const result = await callGemini(SYSTEM_RULES, opts.prompt);
  const finish = (source: "ai" | "fallback", status: string, inTok: number | null = null, outTok: number | null = null) =>
    supabase.rpc("finish_ai_request", {
      p_id: quota.request_id,
      p_source: source,
      p_status: status,
      p_in: inTok ?? 0,
      p_out: outTok ?? 0,
      p_latency: result.latencyMs,
    });

  if (!result.ok) {
    await finish("fallback", result.reason === "timeout" ? "timeout" : "error");
    return fallback(result.reason === "timeout" ? "timeout" : "error", remaining);
  }

  let parsed: T | null = null;
  try {
    const json = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const r = opts.schema.safeParse(json);
    if (r.success) parsed = r.data;
  } catch {
    parsed = null;
  }
  const grounded = parsed && opts.groundNumbers ? opts.groundNumbers(parsed) : null;
  if (
    !parsed ||
    (grounded && !numbersAreGrounded(grounded.text, grounded.allowed)) ||
    (opts.validate && !opts.validate(parsed))
  ) {
    logger.warn("ai output rejected", { action });
    await finish("fallback", "invalid_output", result.inputTokens, result.outputTokens);
    return fallback("invalid_output", remaining);
  }
  await finish("ai", "ok", result.inputTokens, result.outputTokens);
  return { source: "ai", data: parsed, remaining };
}
