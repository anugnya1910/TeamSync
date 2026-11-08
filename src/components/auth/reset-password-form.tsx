"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { updatePassword } from "@/app/(auth)/actions";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  if (!hasSession) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-page-title">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          This password reset link is invalid or has expired. Request a new one to continue.
        </p>
        <Button asChild className="h-10">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-success/15 text-success-text">
          <CircleCheck className="size-6" aria-hidden />
        </div>
        <h1 className="text-page-title">Password updated</h1>
        <p className="text-sm text-muted-foreground">You&apos;re signed in with your new password.</p>
        <Button asChild className="h-10">
          <Link href="/app">Continue</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const res = await updatePassword(values);
      if (!res.ok) setFormError(res.error.message);
      else setDone(true);
    });
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-page-title">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">At least 8 characters, with a letter and a number.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField label="New password" error={errors.password?.message}>
          {(c) => (
            <PasswordInput {...c} autoComplete="new-password" autoFocus className="h-10" {...form.register("password")} />
          )}
        </FormField>
        <FormField label="Confirm new password" error={errors.confirmPassword?.message}>
          {(c) => (
            <PasswordInput {...c} autoComplete="new-password" className="h-10" {...form.register("confirmPassword")} />
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Saving…" className="h-10 w-full">
          Update password
        </SubmitButton>
      </form>
    </div>
  );
}
