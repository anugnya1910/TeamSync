"use client";

import { Keyboard, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { useShellUi } from "./shell-ui-context";
import { useWorkspace } from "./workspace-context";

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useWorkspace();
  const { setShortcutsOpen } = useShellUi();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-auto w-full justify-start gap-2.5 px-2 py-1.5", collapsed && "justify-center px-0")}
          aria-label={`Account menu for ${user.fullName}`}
        >
          <Avatar className="size-7 border">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium">{user.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">@{user.handle}</span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate">{user.fullName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/settings/profile">
              <UserRound className="size-4" aria-hidden /> Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/preferences">
              <SlidersHorizontal className="size-4" aria-hidden /> Preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" aria-hidden /> Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(() => signOut());
          }}
        >
          <LogOut className="size-4" aria-hidden /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
