"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, mapPgError, type ActionResult } from "@/lib/action-result";
import { createWorkspaceWith } from "@/lib/data/workspace-actions-shared";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { onboardingProfileSchema } from "@/lib/validation/profile";
import { createWorkspaceSchema } from "@/lib/validation/workspace";

const onboardingSchema = z.object({
  profile: onboardingProfileSchema,
  workspace: createWorkspaceSchema,
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

/** Runs `complete_onboarding` then `create_workspace`, then redirects to the new workspace. */
export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult<never>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      "VALIDATION",
      "Please check the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    );
  }
  const { profile, workspace } = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase.rpc("complete_onboarding", {
    p_full_name: profile.fullName,
    p_job_title: profile.jobTitle,
    p_timezone: profile.timezone,
    p_avatar_url: profile.avatarUrl,
  });
  if (profileError) return { ok: false, error: mapPgError(profileError) };

  const created = await createWorkspaceWith(supabase, workspace);
  if (!created.ok) return created;

  redirect(`/w/${created.data.slug}`);
}
