import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset password" };

/** Reached via /auth/callback after the recovery link created a session. */
export default async function ResetPasswordPage() {
  const userId = await getCurrentUserId();
  return <ResetPasswordForm hasSession={Boolean(userId)} />;
}
