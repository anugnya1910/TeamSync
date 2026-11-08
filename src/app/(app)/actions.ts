"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapPgError, ok, type ActionResult } from "@/lib/action-result";
import { createWorkspaceWith } from "@/lib/data/workspace-actions-shared";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

/** Create an additional workspace from the sidebar switcher (RPC `create_workspace`). */
export async function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<ActionResult<{ slug: string }>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const supabase = await createClient();
  const res = await createWorkspaceWith(supabase, input);
  if (!res.ok) return res;
  revalidatePath("/w", "layout");
  return ok({ slug: res.data.slug });
}

const themeSchema = z.enum(["system", "light", "dark"]);

/** Persist the theme chosen from the shell toggle to the profile. */
export async function saveThemePreference(theme: string): Promise<ActionResult<null>> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return fail("VALIDATION", "Unknown theme.");
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme: parsed.data }).eq("id", uid);
  if (error) return { ok: false, error: mapPgError(error) };
  return ok(null);
}
