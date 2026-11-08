import type { Metadata } from "next";
import Link from "next/link";
import { MailOpen } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AcceptInvite } from "@/components/workspace/accept-invite";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

const STATUS_TEXT: Record<string, string> = {
  revoked: "This invite has been revoked by a workspace admin.",
  expired: "This invite has expired. Ask the person who invited you for a new link.",
  exhausted: "This invite has already been used the maximum number of times.",
};

/** Public invite preview (spec §B.3): logged out → sign in/up to join; logged in → accept. */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const valid = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  const { data } = valid ? await supabase.rpc("get_invitation_preview", { p_token: token }) : { data: null };
  const preview = data?.[0];
  const next = `/invite/${token}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="TeamSync home">
          <Logo label={null} />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 text-center sm:p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <MailOpen className="size-6" aria-hidden />
          </div>
          {!preview ? (
            <>
              <h1 className="text-page-title">Invite not found</h1>
              <p className="text-sm text-muted-foreground">This invite link isn&apos;t valid. Check that you copied the whole link.</p>
              <Button asChild><Link href="/app">Continue to TeamSync</Link></Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{preview.inviter_name ?? "Someone"} invited you to join</p>
                <h1 className="text-page-title">{preview.workspace_name}</h1>
                <p className="text-sm">as <span className="font-semibold">{ROLE_LABELS[preview.role]}</span>{preview.email_bound ? " · for a specific email address" : ""}</p>
              </div>
              {preview.status !== "active" ? (
                <p className="rounded-lg border bg-surface-2 p-3 text-sm text-muted-foreground">{STATUS_TEXT[preview.status]}</p>
              ) : preview.already_member ? (
                <Button asChild className="w-full"><Link href={`/w/${preview.workspace_slug}`}>You&apos;re already a member — open workspace</Link></Button>
              ) : userId ? (
                <AcceptInvite token={token} />
              ) : (
                <div className="grid gap-2">
                  <Button asChild><Link href={`/signup?next=${encodeURIComponent(next)}`}>Sign up to join</Link></Button>
                  <Button asChild variant="outline"><Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link></Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Expires {new Date(preview.expires_at).toLocaleDateString()}</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
