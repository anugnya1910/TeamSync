"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type">;

/** Password input with show/hide toggle and a caps-lock hint. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className, onKeyUp, onKeyDown, onBlur, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const check = (e: KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          onKeyUp={(e) => {
            check(e);
            onKeyUp?.(e);
          }}
          onKeyDown={(e) => {
            check(e);
            onKeyDown?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {capsLock ? (
        <p className="text-xs text-warning-text" role="status">
          Caps Lock is on
        </p>
      ) : null}
    </div>
  );
});
