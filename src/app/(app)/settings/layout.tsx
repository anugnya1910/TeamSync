import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyWorkspaces, requireProfile } from "@/lib/data/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile("/settings/profile");
  const workspaces = await getMyWorkspaces();
  const back = workspaces.find((w) => w.id === profile.last_workspace_id) ?? workspaces[0];

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-md" aria-label="TeamSync home">
            <Logo label={null} withWordmark={false} />
          </Link>
          <Link
            href={back ? `/w/${back.slug}` : "/onboarding"}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back ? `Back to ${back.name}` : "Finish onboarding"}
          </Link>
        </div>
        <ThemeToggle />
      </header>
      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-6 md:grid-cols-[200px_minmax(0,1fr)] md:px-6 md:py-10">
        <SettingsNav />
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
