"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ThemeChoice = "system" | "light" | "dark";

const subscribe = () => () => {};
/** True only after hydration — avoids a theme-dependent icon mismatch. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

type Props = {
  /** Called after the theme changes (the app shell persists it to the profile). */
  onChange?: (theme: ThemeChoice) => void;
  align?: "start" | "end";
};

export function ThemeToggle({ onChange, align = "end" }: Props) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const Icon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Icon className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-40">
        <DropdownMenuRadioGroup
          value={mounted ? (theme ?? "system") : "system"}
          onValueChange={(value) => {
            setTheme(value);
            onChange?.(value as ThemeChoice);
          }}
        >
          <DropdownMenuRadioItem value="system">
            <Laptop className="size-4" aria-hidden /> System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" aria-hidden /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" aria-hidden /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
