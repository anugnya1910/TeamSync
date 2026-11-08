"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordForm({ initialError }: { initialError?: string | null }) {
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [done, setDone] = useState(false);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const res = await requestPasswordReset(values);
      if (!res.ok) setFormError(res.error.message);
      else setDone(true);
    });
  });

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h1 className="text-page-title">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for that address, a password reset link is on its way. The link
          works once and expires after an hour.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-page-title">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField label="Email" error={form.formState.errors.email?.message}>
          {(c) => (
            <Input
              {...c}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              className="h-10"
              {...form.register("email")}
            />
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Sending…" className="h-10 w-full">
          Send reset link
        </SubmitButton>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
