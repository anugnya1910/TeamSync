import type { Metadata } from "next";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { requireProfile } from "@/lib/data/session";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const profile = await requireProfile("/settings/notifications");
  const prefs = (profile.notification_prefs && typeof profile.notification_prefs === "object" && !Array.isArray(profile.notification_prefs)
    ? profile.notification_prefs
    : {}) as Record<string, boolean>;
  return (
    <div className="space-y-6">
      <h1 className="text-page-title">Notifications</h1>
      <NotificationPrefsForm initial={prefs} />
    </div>
  );
}
