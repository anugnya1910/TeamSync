import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable server env so each test can toggle the key without re-importing modules.
const env = vi.hoisted(() => ({ GEMINI_API_KEY: undefined as string | undefined, GEMINI_MODEL: undefined as string | undefined, AI_GLOBAL_DAILY_LIMIT: 200 }));
vi.mock("@/lib/env.server", () => ({ serverEnv: env }));

import { breakdownFallback, prioritiesFallback, splitEffort, statNumbers, summaryFallback, type ProjectStats } from "@/lib/ai/fallbacks";
import { runAiAction } from "@/lib/ai/run-ai";
import { breakdownSchema, EFFORTS, numbersAreGrounded, prioritiesSchema, summarySchema } from "@/lib/ai/schemas";
import type { TaskLite } from "@/lib/algorithms/types";

const stats: ProjectStats = {
  name: "Capstone",
  totalTasks: 12,
  openTasks: 7,
  doneTasks: 5,
  completionPct: 41,
  overdueTasks: 2,
  blockedTasks: 1,
  pulseScore: 63,
  pulseBand: "watch",
  topRisk: "CAP-4 is 3 days overdue",
  nextMilestone: { name: "Demo", due: "2026-11-20", forecast: "2026-11-23" },
  completedThisWeek: 3,
};

describe("schemas", () => {
  it("breakdown accepts 1–8 subtasks with valid efforts and rejects malformed output", () => {
    expect(breakdownSchema.safeParse({ subtasks: [{ title: "Outline", effort: 3 }] }).success).toBe(true);
    expect(breakdownSchema.safeParse({ subtasks: [{ title: "Outline", effort: 4 }] }).success).toBe(false);
    expect(breakdownSchema.safeParse({ subtasks: [] }).success).toBe(false);
    expect(breakdownSchema.safeParse({ steps: ["a"] }).success).toBe(false);
  });
  it("summary rejects empty text; priorities need ids", () => {
    expect(summarySchema.safeParse({ markdown: "  " }).success).toBe(false);
    expect(prioritiesSchema.safeParse({ ranked: [{ taskId: "not-a-uuid", reason: "x" }] }).success).toBe(false);
    expect(prioritiesSchema.safeParse({ ranked: [{ taskId: "8f1e7c52-0d5b-4b8e-9a37-1c2d3e4f5a6b", reason: "x" }] }).success).toBe(true);
  });
});

describe("numbersAreGrounded", () => {
  it("accepts only numbers that appear in the provided stats", () => {
    expect(numbersAreGrounded("41% done, 2 overdue", [41, 2])).toBe(true);
    expect(numbersAreGrounded("Velocity is 9 points a week", [41, 2])).toBe(false);
    expect(numbersAreGrounded("No numbers here", [])).toBe(true);
    expect(numbersAreGrounded("Pulse 63/100", ["63", 100])).toBe(true);
  });
});

describe("fallbacks", () => {
  it("splitEffort always returns valid estimates, exact for the breakdown's part counts", () => {
    for (let total = 1; total <= 40; total++) {
      for (let n = 1; n <= 5; n++) {
        const parts = splitEffort(total, n);
        expect(parts).toHaveLength(n);
        for (const p of parts) expect(EFFORTS).toContain(p);
      }
      // breakdownFallback uses n = min(5, total): those splits are always exact up to 40 points.
      expect(splitEffort(total, Math.min(5, total)).reduce((s, p) => s + p, 0)).toBe(total);
    }
    expect(splitEffort(20, 5)).toEqual([5, 5, 5, 3, 2]);
  });
  it("breakdown picks a keyword family and matches the parent effort", () => {
    const b = breakdownFallback("Write the final report", null, 13);
    expect(b.subtasks.map((s) => s.title)[0]).toBe("Outline the structure");
    expect(b.subtasks.reduce((s, x) => s + x.effort, 0)).toBe(13);
    expect(breakdownSchema.safeParse(b).success).toBe(true);
    const d = breakdownFallback("Something vague", null, null);
    expect(d.subtasks.map((s) => s.title)).toEqual(["Research", "Implement", "Test", "Document", "Review"]);
  });
  it("is deterministic", () => {
    expect(breakdownFallback("Build the API", "auth endpoints", 8)).toEqual(breakdownFallback("Build the API", "auth endpoints", 8));
    expect(summaryFallback(stats)).toEqual(summaryFallback(stats));
  });
  it("summary fallback only states numbers from the real stats", () => {
    const s = summaryFallback(stats);
    expect(summarySchema.safeParse(s).success).toBe(true);
    expect(numbersAreGrounded(s.markdown, [...statNumbers(stats), ...(stats.topRisk?.match(/\d+/g) ?? [])])).toBe(true);
    expect(s.markdown).toContain("41%");
  });
  it("priorities fallback ranks urgent overdue work first", () => {
    const t = (id: string, o: Partial<TaskLite>): TaskLite => ({ id, parentTaskId: null, status: "todo", priority: "low", effort: 1, dueDate: null, isBlocked: false, assigneeIds: [], ...o });
    const A = "8f1e7c52-0d5b-4b8e-9a37-1c2d3e4f5a6b";
    const B = "1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b";
    const out = prioritiesFallback([t(A, {}), t(B, { priority: "urgent", dueDate: "2026-11-01" })], [], "2026-11-08");
    expect(prioritiesSchema.safeParse(out).success).toBe(true);
    expect(out.ranked[0]!.taskId).toBe(B);
    expect(out.ranked[0]!.reason).toContain("overdue since 2026-11-01");
  });
});

// ---------------------------------------------------------------------------------------------
// Orchestrator with a fake Supabase client and mocked fetch.

type Call = { fn: string; args: Record<string, unknown> };
function fakeSupabase(opts: { global?: number; quota?: Partial<{ allowed: boolean; reason: string | null }> } = {}) {
  const calls: Call[] = [];
  const supabase = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push({ fn, args });
      if (fn === "ai_requests_today_global") return { data: opts.global ?? 0, error: null };
      if (fn === "consume_ai_quota")
        return { data: [{ allowed: opts.quota?.allowed ?? true, reason: opts.quota?.reason ?? null, user_remaining: 19, workspace_remaining: 99, request_id: "req-1" }], error: null };
      return { data: null, error: null };
    }),
  };
  return { supabase: supabase as never, calls };
}

const geminiReply = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }), { status: 200 });

const base = {
  workspaceId: "ws-1",
  action: "summary" as const,
  prompt: "p",
  schema: summarySchema,
  fallback: () => summaryFallback(stats),
  groundNumbers: (d: { markdown: string }) => ({ text: d.markdown, allowed: statNumbers(stats) }),
};

describe("runAiAction", () => {
  beforeEach(() => {
    env.GEMINI_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    env.GEMINI_API_KEY = undefined;
  });

  it("falls back with not_configured when there is no key, without calling the provider", async () => {
    env.GEMINI_API_KEY = undefined;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { supabase, calls } = fakeSupabase();
    const r = await runAiAction({ ...base, supabase });
    expect(r).toMatchObject({ source: "fallback", reason: "not_configured" });
    expect(r.data).toEqual(summaryFallback(stats));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(calls.map((c) => c.fn)).toEqual(["log_ai_fallback"]);
  });

  it("respects the global and per-user quotas", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await runAiAction({ ...base, ...fakeSupabase({ global: 200 }) })).toMatchObject({ source: "fallback", reason: "global_limit" });
    expect(await runAiAction({ ...base, ...fakeSupabase({ quota: { allowed: false, reason: "user_limit" } }) })).toMatchObject({ source: "fallback", reason: "user_limit", remaining: { user: 19 } });
  });

  it("returns validated, grounded AI output and logs success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(JSON.stringify({ markdown: "Capstone is 41% done with 2 overdue tasks." }))));
    const { supabase, calls } = fakeSupabase();
    const r = await runAiAction({ ...base, supabase });
    expect(r).toMatchObject({ source: "ai", data: { markdown: "Capstone is 41% done with 2 overdue tasks." } });
    expect(calls.find((c) => c.fn === "finish_ai_request")?.args).toMatchObject({ p_id: "req-1", p_source: "ai", p_status: "ok", p_in: 10, p_out: 20 });
  });

  it("strips a ```json fence before parsing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply('```json\n{"markdown":"5 of 12 tasks are done."}\n```')));
    expect((await runAiAction({ ...base, ...fakeSupabase() })).source).toBe("ai");
  });

  it("rejects invented numbers (grounding) and invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(JSON.stringify({ markdown: "Velocity is 17 points per week." }))));
    expect(await runAiAction({ ...base, ...fakeSupabase() })).toMatchObject({ source: "fallback", reason: "invalid_output" });
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply("not json")));
    const { supabase, calls } = fakeSupabase();
    expect(await runAiAction({ ...base, supabase })).toMatchObject({ source: "fallback", reason: "invalid_output" });
    expect(calls.find((c) => c.fn === "finish_ai_request")?.args).toMatchObject({ p_source: "fallback", p_status: "invalid_output" });
  });

  it("maps provider errors and timeouts to fallbacks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    expect(await runAiAction({ ...base, ...fakeSupabase() })).toMatchObject({ source: "fallback", reason: "error" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }),
    );
    expect(await runAiAction({ ...base, ...fakeSupabase() })).toMatchObject({ source: "fallback", reason: "timeout" });
  });

  it("applies extra semantic validation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply(JSON.stringify({ markdown: "All good." }))));
    expect(await runAiAction({ ...base, ...fakeSupabase(), validate: () => false })).toMatchObject({ source: "fallback", reason: "invalid_output" });
  });
});
