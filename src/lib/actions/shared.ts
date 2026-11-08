import "server-only";
import { z } from "zod";
import { fail, mapPgError, type ActionResult, type PgErrorLike } from "@/lib/action-result";
import { createClient, getCurrentUserId, type ServerSupabaseClient } from "@/lib/supabase/server";

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/** Parse → authenticated session client, or a typed failure. */
export async function withSession<S extends z.ZodTypeAny, T>(
  schema: S,
  input: unknown,
  run: (ctx: { data: z.output<S>; supabase: ServerSupabaseClient; userId: string }) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const userId = await getCurrentUserId();
  if (!userId) return fail("UNAUTHENTICATED", "Please sign in again.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check the highlighted fields.", fieldErrors(parsed.error));
  const supabase = await createClient();
  return run({ data: parsed.data, supabase, userId });
}

export function pgFail(error: PgErrorLike | null): { ok: false; error: ReturnType<typeof mapPgError> } {
  return { ok: false, error: mapPgError(error) };
}
