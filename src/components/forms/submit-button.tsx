"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string };

export function SubmitButton({ pending, pendingLabel, children, disabled, ...props }: Props) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
