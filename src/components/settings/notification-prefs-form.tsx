"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateNotificationPrefs } from "@/app/(app)/settings/actions";
import { NOTIFICATION_META } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsCard } from "./settings-card";

export function NotificationPrefsForm({ initial }: { initial: Record<string, boolean> }) {
  const types = Object.keys(NOTIFICATION_META);
  const start0 = Object.fromEntries(types.map((t) => [t, initial[t] !== false]));
  const [prefs, setPrefs] = useState<Record<string, boolean>>(start0);
  const [saved, setSaved] = useState(start0);
  const [pending, start] = useTransition();
  const dirty = types.some((t) => prefs[t] !== saved[t]);
  return (
    <SettingsCard
      title="In-app notifications"
      description="Choose which notifications appear in your inbox and bell. Email notifications are not part of TeamSync."
      footer={
        <Button
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const res = await updateNotificationPrefs(prefs);
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              setSaved(prefs);
              toast.success("Saved");
            })
          }
        >
          Save preferences
        </Button>
      }
    >
      <ul className="divide-y">
        {types.map((t) => {
          const meta = NOTIFICATION_META[t as keyof typeof NOTIFICATION_META];
          const id = `pref-${t}`;
          return (
            <li key={t} className="flex items-center justify-between gap-4 py-2.5">
              <label htmlFor={id} className="flex items-center gap-2 text-sm">
                <meta.icon className="size-4 text-muted-foreground" aria-hidden /> {meta.label}
              </label>
              <Switch id={id} checked={prefs[t]} onCheckedChange={(v) => setPrefs({ ...prefs, [t]: v })} />
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}
