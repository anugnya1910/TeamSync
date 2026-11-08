"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { changePassword, signOutOtherSessions } from "@/app/(app)/settings/actions";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { passwordSchema } from "@/lib/validation/auth";
import { SettingsCard } from "./settings-card";

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const [pending, start] = useTransition();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" } });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      const res = await changePassword(values);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Password updated");
      form.reset({ password: "", confirmPassword: "" });
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsCard
        title="Change password"
        description="Use at least 8 characters with a letter and a number."
        footer={
          <SubmitButton pending={pending} pendingLabel="Updating…" disabled={!isDirty}>
            Update password
          </SubmitButton>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="New password" error={errors.password?.message}>
            {(c) => <PasswordInput {...c} autoComplete="new-password" {...form.register("password")} />}
          </FormField>
          <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
            {(c) => <PasswordInput {...c} autoComplete="new-password" {...form.register("confirmPassword")} />}
          </FormField>
        </div>
      </SettingsCard>
    </form>
  );
}

export function SessionsCard() {
  const [pending, start] = useTransition();
  return (
    <SettingsCard
      title="Sessions"
      description="Signed in somewhere you don't recognise? Sign out everywhere except this browser."
      footer={
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await signOutOtherSessions();
              if (res.ok) toast.success("Signed out of other sessions");
              else toast.error(res.error.message);
            })
          }
        >
          {pending ? "Signing out…" : "Sign out other sessions"}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">This keeps you signed in on the current device.</p>
    </SettingsCard>
  );
}
