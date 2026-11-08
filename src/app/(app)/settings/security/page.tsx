import type { Metadata } from "next";
import { SettingsCard } from "@/components/settings/settings-card";
import { ChangePasswordForm, SessionsCard } from "@/components/settings/security-forms";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  await requireProfile("/settings/security");
  return (
    <div className="space-y-6">
      <h1 className="text-page-title">Security</h1>
      <ChangePasswordForm />
      <SessionsCard />
      <SettingsCard title="Delete account" tone="danger" description="Permanently delete your account and personal data.">
        <p className="text-sm text-muted-foreground">
          Account deletion (with workspace-ownership checks) and personal data export arrive in
          Phase 4. Until then, contact your workspace owner to be removed from a workspace.
        </p>
      </SettingsCard>
    </div>
  );
}
