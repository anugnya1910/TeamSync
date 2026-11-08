import "server-only";
import { fail, mapPgError, ok, type ActionResult } from "@/lib/action-result";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { z } from "zod";

/** Validates input and calls the `create_workspace` RPC. Shared by onboarding and the switcher. */
export async function createWorkspaceWith(
  supabase: ServerSupabaseClient,
  input: { name: string; slug: string },
): Promise<ActionResult<{ slug: string; id: string }>> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION",
      "Please check the workspace details.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    );
  }
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error || !data) {
    const mapped = mapPgError(error);
    if (mapped.code === "CONFLICT") {
      return fail("CONFLICT", "That workspace URL is already taken.", {
        slug: ["That workspace URL is already taken."],
      });
    }
    return { ok: false, error: mapped };
  }
  return ok({ slug: data.slug, id: data.id });
}
