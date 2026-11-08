import type { Metadata } from "next";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const profile = await requireProfile("/settings/preferences");
  const theme = (["system", "light", "dark"] as const).find((t) => t === profile.theme) ?? "system";
  return (
    <div className="space-y-6">
      <h1 className="text-page-title">Preferences</h1>
      <PreferencesForm
        defaults={{
          theme,
          reducedMotion: profile.reduced_motion,
          weekStart: profile.week_start === 0 ? 0 : 1,
          weekendStreakProtection: profile.weekend_streak_protection,
          showOnLeaderboard: profile.show_on_leaderboard,
        }}
      />
    </div>
  );
}
