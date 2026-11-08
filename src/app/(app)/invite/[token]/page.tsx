import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ComingSoon } from "@/components/brand/coming-soon";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default function InvitePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="TeamSync home">
          <Logo label={null} />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4">
        <ComingSoon
          phase={2}
          icon={MailOpen}
          title="Workspace invitations"
          description="Invite links let teammates join a workspace with the role you choose. Accepting invites is enabled in Phase 2 — until then, create your own workspace."
          backHref="/app"
          backLabel="Continue to TeamSync"
        />
      </main>
    </div>
  );
}
