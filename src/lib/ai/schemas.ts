import { z } from "zod";

export const EFFORTS = [1, 2, 3, 5, 8, 13] as const;
const effort = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13)]);
const priority = z.enum(["urgent", "high", "medium", "low", "none"]);

export const breakdownSchema = z.object({
  subtasks: z.array(z.object({ title: z.string().trim().min(1).max(200), effort })).min(1).max(8),
});

export const summarySchema = z.object({ markdown: z.string().trim().min(1).max(1600) });

export const planSchema = z.object({
  milestones: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        dueOffsetDays: z.number().int().min(0).max(365),
        tasks: z
          .array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(500).default(""), priority, effort }))
          .min(1)
          .max(10),
      }),
    )
    .min(1)
    .max(6),
});

export const prioritiesSchema = z.object({
  ranked: z.array(z.object({ taskId: z.uuid(), reason: z.string().trim().min(1).max(240) })).min(1).max(20),
});

export const risksSchema = z.object({
  narrative: z.string().trim().min(1).max(900),
  actions: z.array(z.string().trim().min(1).max(160)).length(3),
});

export type BreakdownOut = z.infer<typeof breakdownSchema>;
export type SummaryOut = z.infer<typeof summarySchema>;
export type PlanOut = z.infer<typeof planSchema>;
export type PrioritiesOut = z.infer<typeof prioritiesSchema>;
export type RisksOut = z.infer<typeof risksSchema>;

export type AiAction = "breakdown" | "summary" | "plan_project" | "priorities" | "risks";

/** Every number in `text` must appear in `allowed` (spec §B.22 "AI never invents metrics"). */
export function numbersAreGrounded(text: string, allowed: Iterable<number | string>): boolean {
  const ok = new Set([...allowed].map((n) => String(n).replace(/%$/, "")));
  // Small counting words like "3 actions" are allowed via the explicit list only.
  const found = text.match(/\d+(?:\.\d+)?%?/g) ?? [];
  return found.every((n) => ok.has(n.replace(/%$/, "")));
}
