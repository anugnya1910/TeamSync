import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { ComingSoon } from "@/components/brand/coming-soon";

export const metadata: Metadata = { title: "Notification settings" };

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-page-title">Notifications</h1>
      <div className="rounded-2xl border bg-card">
        <ComingSoon
          phase={2}
          icon={BellRing}
          title="Notification preferences"
          description="Choose which in-app notifications you receive — assignments, mentions, comments, due dates and more — once notifications ship."
        />
      </div>
    </div>
  );
}
