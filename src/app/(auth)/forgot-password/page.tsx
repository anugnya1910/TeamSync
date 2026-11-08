import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const sp = await searchParams;
  const expired = sp.error === "link_expired";
  return (
    <ForgotPasswordForm
      initialError={expired ? "That reset link has expired. Request a new one below." : null}
    />
  );
}
