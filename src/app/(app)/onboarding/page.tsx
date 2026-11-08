import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyWorkspaces, requireProfile } from "@/lib/data/session";
import { clientEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const profile = await requireProfile("/onboarding");
  const workspaces = await getMyWorkspaces();
  // Onboarding can't be skipped without a workspace; once both exist, go to the app.
  if (profile.onboarded_at && workspaces.length > 0) redirect("/app");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="TeamSync home">
          <Logo label={null} />
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-10">
        <OnboardingWizard
          userId={profile.id}
          defaultName={profile.full_name}
          defaultJobTitle={profile.job_title ?? ""}
          defaultAvatar={profile.avatar_url ?? ""}
          defaultTimezone={profile.onboarded_at ? profile.timezone : null}
          appUrl={clientEnv.NEXT_PUBLIC_APP_URL}
        />
      </main>
    </div>
  );
}
