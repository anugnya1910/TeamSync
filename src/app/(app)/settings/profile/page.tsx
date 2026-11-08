import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const profile = await requireProfile("/settings/profile");
  return (
    <div className="space-y-6">
      <h1 className="text-page-title">Profile</h1>
      <ProfileForm
        userId={profile.id}
        defaults={{
          fullName: profile.full_name,
          handle: profile.handle,
          jobTitle: profile.job_title ?? "",
          timezone: profile.timezone,
          avatarUrl: profile.avatar_url ?? "",
        }}
      />
    </div>
  );
}
