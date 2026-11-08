"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signIn } from "@/app/(auth)/actions";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { GoogleButton } from "./google-button";
import { OrDivider } from "./or-divider";

type Props = { next?: string | null; googleEnabled: boolean; initialError?: string | null };

export function LoginForm({ next, googleEnabled, initialError }: Props) {
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    start(async () => {
      const res = await signIn(values, next);
      if (res && !res.ok) setFormError(res.error.message);
    });
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-page-title">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to your TeamSync workspace.</p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton next={next} />
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField label="Email" error={errors.email?.message}>
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
        <FormField
          label="Password"
          error={errors.password?.message}
          labelAside={
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        >
          {(c) => (
            <PasswordInput {...c} autoComplete="current-password" className="h-10" {...form.register("password")} />
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Logging in…" className="h-10 w-full">
          Log in
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to TeamSync?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
