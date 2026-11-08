import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : null;
  return <SignupForm googleEnabled={clientEnv.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH} next={next} />;
}
