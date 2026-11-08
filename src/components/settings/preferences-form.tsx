"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updatePreferences } from "@/app/(app)/settings/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { preferencesSchema, type PreferencesInput } from "@/lib/validation/profile";
import { SettingsCard } from "./settings-card";

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-d`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-d`} />
    </div>
  );
}

function RadioRow<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="flex flex-wrap gap-4">
        {options.map((o) => (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem value={o.value} id={`${id}-${o.value}`} />
            <label htmlFor={`${id}-${o.value}`} className="text-sm">
              {o.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

export function PreferencesForm({ defaults }: { defaults: PreferencesInput }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [pending, start] = useTransition();
  const form = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: defaults,
  });
  const { isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    start(async () => {
      const res = await updatePreferences(values);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTheme(values.theme);
      document.documentElement.dataset.reducedMotion = values.reducedMotion ? "true" : "false";
      toast.success("Saved");
      form.reset(values);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsCard
        title="Preferences"
        description="Personalise how TeamSync looks and behaves for you."
        footer={
          <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!isDirty}>
            Save preferences
          </SubmitButton>
        }
      >
        <Controller
          control={form.control}
          name="theme"
          render={({ field }) => (
            <RadioRow
              legend="Theme"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="weekStart"
          render={({ field }) => (
            <RadioRow
              legend="Week starts on"
              value={String(field.value) as "0" | "1"}
              onChange={(v) => field.onChange(Number(v) as 0 | 1)}
              options={[
                { value: "1", label: "Monday" },
                { value: "0", label: "Sunday" },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="reducedMotion"
          render={({ field }) => (
            <SwitchRow
              label="Reduce motion"
              description="Turns off non-essential animation, in addition to your device setting."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="weekendStreakProtection"
          render={({ field }) => (
            <SwitchRow
              label="Weekend streak protection"
              description="Weekends won't break your productivity streak. Streaks start counting in Phase 3."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="showOnLeaderboard"
          render={({ field }) => (
            <SwitchRow
              label="Show me on leaderboards"
              description="Opt out to keep your XP private. Leaderboards arrive in Phase 3."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </SettingsCard>
    </form>
  );
}
