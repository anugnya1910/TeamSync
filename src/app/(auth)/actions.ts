"use server";

import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { mapAuthError } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/safe-next";
import { clientEnv } from "@/lib/env";
import { getAppOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validation/auth";
import { z } from "zod";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export async function signIn(input: LoginInput, next?: string | null): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your details.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("UNAUTHENTICATED", mapAuthError(error));

  redirect(safeNextPath(next, "/app"));
}

export async function signUp(
  input: SignupInput,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your details.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const origin = await getAppOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) return fail("VALIDATION", mapAuthError(error));

  if (data.session) redirect("/onboarding");
  // No session → email confirmation required (or the address already exists; we never say which).
  return ok({ needsConfirmation: true });
}

export async function signInWithGoogle(next?: string | null): Promise<ActionResult<null>> {
  if (!clientEnv.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH) {
    return fail("FORBIDDEN", "Google sign-in is not enabled.");
  }
  const supabase = await createClient();
  const origin = await getAppOrigin();
  const target = safeNextPath(next, "/app");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(target)}` },
  });
  if (error || !data.url) return fail("INTERNAL", mapAuthError(error));
  redirect(data.url);
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ActionResult<null>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your email.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const origin = await getAppOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Only surface rate limiting; otherwise always report success (no account enumeration).
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    return fail("RATE_LIMITED", mapAuthError(error));
  }
  return ok(null);
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult<null>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Please check your password.", fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return fail("UNAUTHENTICATED", "Your reset link has expired. Please request a new one.");
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("VALIDATION", mapAuthError(error));
  return ok(null);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
