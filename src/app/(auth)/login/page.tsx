import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  link_invalid: "That sign-in link is invalid or has expired. Please log in or request a new link.",
  oauth_cancelled: "Google sign-in was cancelled. You can try again or use your email.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  const errorKey = typeof sp.error === "string" ? sp.error : null;
  return (
    <LoginForm
      next={next}
      googleEnabled={clientEnv.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH}
      initialError={errorKey ? (ERRORS[errorKey] ?? null) : null}
    />
  );
}
