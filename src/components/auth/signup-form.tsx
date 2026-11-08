"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signUp } from "@/app/(auth)/actions";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { GoogleButton } from "./google-button";
import { OrDivider } from "./or-divider";

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const res = await signUp(values);
      if (!res) return;
      if (!res.ok) {
        setFormError(res.error.message);
        const fe = res.error.fieldErrors;
        if (fe) {
          for (const [k, v] of Object.entries(fe)) {
            if (v?.[0]) form.setError(k as keyof SignupInput, { message: v[0] });
          }
        }
        return;
      }
      if (res.data.needsConfirmation) setSentTo(values.email);
    });
  });

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h1 className="text-page-title">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{sentTo}</span> can be used for a new
          account, we&apos;ve sent a confirmation link. Open it on this device to continue to
          onboarding.
        </p>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t get it? Check spam, or wait a minute and{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSentTo(null)}>
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-page-title">Create your account</h1>
        <p className="text-sm text-muted-foreground">Free for student and small teams.</p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton next="/onboarding" />
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField label="Full name" error={errors.fullName?.message}>
          {(c) => (
            <Input {...c} autoComplete="name" autoFocus className="h-10" {...form.register("fullName")} />
          )}
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          {(c) => (
            <Input
              {...c}
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-10"
              {...form.register("email")}
            />
          )}
        </FormField>
        <FormField
          label="Password"
          error={errors.password?.message}
          description="At least 8 characters, with a letter and a number."
        >
          {(c) => (
            <PasswordInput {...c} autoComplete="new-password" className="h-10" {...form.register("password")} />
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Creating account…" className="h-10 w-full">
          Create account
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
