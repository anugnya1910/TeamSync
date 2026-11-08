"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/settings/actions";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { TimezoneSelect } from "@/components/profile/timezone-select";
import { Input } from "@/components/ui/input";
import { useHandleAvailability } from "@/hooks/use-handle-availability";
import { profileSettingsSchema, type ProfileSettingsInput } from "@/lib/validation/profile";
import { SettingsCard } from "./settings-card";

function HandleHint({ status }: { status: ReturnType<typeof useHandleAvailability> }) {
  const base = "flex items-center gap-1.5 text-xs";
  switch (status) {
    case "checking":
      return (
        <p className={`${base} text-muted-foreground`} aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking…
        </p>
      );
    case "available":
      return (
        <p className={`${base} text-success-text`} aria-live="polite">
          <CircleCheck className="size-3.5" aria-hidden /> Available
        </p>
      );
    case "taken":
      return (
        <p className={`${base} text-danger-text`} aria-live="polite">
          <CircleAlert className="size-3.5" aria-hidden /> That handle is taken
        </p>
      );
    default:
      return null;
  }
}

export function ProfileForm({ userId, defaults }: { userId: string; defaults: ProfileSettingsInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<ProfileSettingsInput>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: defaults,
  });
  const { errors, isDirty } = form.formState;
  const handleValue = useWatch({ control: form.control, name: "handle" });
  const name = useWatch({ control: form.control, name: "fullName" });
  const handleStatus = useHandleAvailability(handleValue ?? "", defaults.handle);

  const onSubmit = form.handleSubmit((values) => {
    if (handleStatus === "taken") {
      form.setError("handle", { message: "That handle is already taken." });
      return;
    }
    start(async () => {
      const res = await updateProfile(values);
      if (!res.ok) {
        for (const [k, v] of Object.entries(res.error.fieldErrors ?? {})) {
          if (v?.[0]) form.setError(k as keyof ProfileSettingsInput, { message: v[0] });
        }
        toast.error(res.error.message);
        return;
      }
      toast.success("Saved");
      form.reset(values);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsCard
        title="Profile"
        description="How teammates see you across TeamSync."
        footer={
          <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!isDirty}>
            Save changes
          </SubmitButton>
        }
      >
        <Controller
          control={form.control}
          name="avatarUrl"
          render={({ field }) => (
            <AvatarUploader
              userId={userId}
              name={name}
              value={field.value}
              onChange={(url) => field.onChange(url)}
            />
          )}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" error={errors.fullName?.message}>
            {(c) => <Input {...c} autoComplete="name" {...form.register("fullName")} />}
          </FormField>
          <FormField
            label="Handle"
            error={errors.handle?.message}
            description="Used for @mentions. 3–20 lowercase letters, numbers or underscores."
          >
            {(c) => (
              <div className="space-y-1.5">
                <div className="flex h-8 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="px-2.5 text-sm text-muted-foreground" aria-hidden>
                    @
                  </span>
                  <input
                    {...c}
                    spellCheck={false}
                    autoCapitalize="none"
                    className="h-full min-w-0 flex-1 bg-transparent pr-2.5 text-sm outline-none"
                    {...form.register("handle", {
                      setValueAs: (v: string) => v.toLowerCase(),
                    })}
                  />
                </div>
                <HandleHint status={handleStatus} />
              </div>
            )}
          </FormField>
          <FormField label="Job title" error={errors.jobTitle?.message}>
            {(c) => <Input {...c} autoComplete="organization-title" {...form.register("jobTitle")} />}
          </FormField>
          <FormField label="Timezone" error={errors.timezone?.message}>
            {(c) => (
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <TimezoneSelect {...c} value={field.value} onChange={(tz) => field.onChange(tz)} />
                )}
              />
            )}
          </FormField>
        </div>
      </SettingsCard>
    </form>
  );
}
