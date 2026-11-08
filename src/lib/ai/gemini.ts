import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * Minimal Gemini REST client (no SDK). Model and base URL come from env because model names
 * and free-tier eligibility change; verify the default against Google AI Studio at deploy time.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
export const AI_TIMEOUT_MS = 8000;

export type GeminiResult =
  | { ok: true; text: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number }
  | { ok: false; reason: "not_configured" | "timeout" | "error"; latencyMs: number };

export function geminiConfigured(): boolean {
  return Boolean(serverEnv.GEMINI_API_KEY);
}

export async function callGemini(system: string, user: string, fetchImpl: typeof fetch = fetch): Promise<GeminiResult> {
  const started = Date.now();
  const key = serverEnv.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "not_configured", latencyMs: 0 };
  const model = serverEnv.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 1200 },
      }),
    });
    if (!res.ok) return { ok: false, reason: "error", latencyMs: Date.now() - started };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      ok: true,
      text,
      inputTokens: json.usageMetadata?.promptTokenCount ?? null,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? null,
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "error", latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}
