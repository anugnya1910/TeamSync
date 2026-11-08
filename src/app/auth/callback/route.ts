import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback: exchanges the PKCE `code` (OAuth, email confirmation, password recovery) or a
 * `token_hash` (custom email templates) for a session, then redirects to a safe relative `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), "/app");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(new URL(`/login?error=oauth_cancelled`, origin));
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const target = type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(new URL(target, origin));
    }
  }

  const failTarget = next === "/reset-password" ? "/forgot-password?error=link_expired" : "/login?error=link_invalid";
  return NextResponse.redirect(new URL(failTarget, origin));
}
