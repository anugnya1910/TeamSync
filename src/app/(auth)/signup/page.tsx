import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <SignupForm googleEnabled={clientEnv.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH} />;
}
