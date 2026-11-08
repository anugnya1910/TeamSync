"use client";

import { useId, type ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type ControlProps = {
  id: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
};

type FormFieldProps = {
  label: ReactNode;
  error?: string;
  description?: ReactNode;
  className?: string;
  /** Hide the label visually (still available to screen readers) */
  srOnlyLabel?: boolean;
  labelAside?: ReactNode;
  children: (control: ControlProps) => ReactNode;
};

/** Label + control + description + error with `aria-describedby` wiring (spec §F.8). */
export function FormField({
  label,
  error,
  description,
  className,
  srOnlyLabel,
  labelAside,
  children,
}: FormFieldProps) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id} className={cn(srOnlyLabel && "sr-only")}>
          {label}
        </FieldLabel>
        {labelAside}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {description ? <FieldDescription id={descId}>{description}</FieldDescription> : null}
      {error ? <FieldError id={errId}>{error}</FieldError> : null}
    </Field>
  );
}
