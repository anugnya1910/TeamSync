"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapPgError, ok, type ActionResult } from "@/lib/action-result";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validation/auth";
import {
  preferencesSchema,
  profileSettingsSchema,
  type PreferencesInput,
  type ProfileSettingsInput,
} from "@/lib/validation/profile";
import { mapAuthError } from "@/lib/auth/errors";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function updateProfile(input: ProfileSettingsInput): Promise<ActionResult<null>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check the highlighted fields.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      handle: parsed.data.handle,
      job_title: parsed.data.jobTitle || null,
      timezone: parsed.data.timezone,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", uid);
  if (error) {
    const mapped = mapPgError(error);
    if (mapped.code === "CONFLICT") {
      return fail("CONFLICT", "That handle is already taken.", { handle: ["That handle is already taken."] });
    }
    return { ok: false, error: mapped };
  }
  revalidatePath("/", "layout");
  return ok(null);
}

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult<null>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your preferences.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      theme: parsed.data.theme,
      reduced_motion: parsed.data.reducedMotion,
      week_start: parsed.data.weekStart,
      weekend_streak_protection: parsed.data.weekendStreakProtection,
      show_on_leaderboard: parsed.data.showOnLeaderboard,
    })
    .eq("id", uid);
  if (error) return { ok: false, error: mapPgError(error) };
  revalidatePath("/", "layout");
  return ok(null);
}

const changePasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function changePassword(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<null>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your new password.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("VALIDATION", mapAuthError(error));
  return ok(null);
}

export async function signOutOtherSessions(): Promise<ActionResult<null>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return fail("INTERNAL", mapAuthError(error));
  return ok(null);
}

const NOTIFICATION_TYPES = [
  "task_assigned",
  "mentioned",
  "comment_on_assigned",
  "status_changed_on_assigned",
  "due_soon",
  "overdue",
  "invited_to_project",
  "achievement_unlocked",
  "rebalance_suggested",
] as const;
const prefsSchema = z.object(Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, z.boolean()])) as Record<(typeof NOTIFICATION_TYPES)[number], z.ZodBoolean>);

export async function updateNotificationPrefs(input: Record<string, boolean>): Promise<ActionResult<null>> {
  const uid = await getCurrentUserId();
  if (!uid) return fail("UNAUTHENTICATED", "Please sign in again.");
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Unknown notification preference.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notification_prefs: parsed.data }).eq("id", uid);
  if (error) return { ok: false, error: mapPgError(error) };
  return ok(null);
}
