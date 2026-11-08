import type { Metadata } from "next";
import { AchievementsGallery, type AchievementItem } from "@/components/gamification/achievements-gallery";
import { ProfileForm } from "@/components/settings/profile-form";
import { requireProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const profile = await requireProfile("/settings/profile");
  const supabase = await createClient();
  const [catalogue, mine] = await Promise.all([
    supabase.from("achievements").select("code, name, description, icon, xp_reward").order("xp_reward"),
    supabase.from("user_achievements").select("achievement_code, unlocked_at, workspace:workspaces!inner(name)").eq("user_id", profile.id),
  ]);
  const items: AchievementItem[] = (catalogue.data ?? []).map((a) => ({
    code: a.code,
    name: a.name,
    description: a.description,
    icon: a.icon,
    xpReward: a.xp_reward,
    unlocked: (mine.data ?? [])
      .filter((u) => u.achievement_code === a.code)
      .map((u) => ({ at: u.unlocked_at, workspace: (u.workspace as { name: string }).name })),
  }));
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
      <AchievementsGallery items={items} />
    </div>
  );
}
