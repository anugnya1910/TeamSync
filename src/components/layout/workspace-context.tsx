"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceRole } from "@/lib/domain";

export type ShellWorkspace = { id: string; name: string; slug: string; logoUrl: string | null };
export type ShellWorkspaceListItem = ShellWorkspace & { role: WorkspaceRole };
export type ShellUser = {
  id: string;
  fullName: string;
  handle: string;
  avatarUrl: string | null;
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  timezone: string;
  weekStart: 0 | 1;
};

export type WorkspaceContextValue = {
  workspace: ShellWorkspace;
  role: WorkspaceRole;
  workspaces: ShellWorkspaceListItem[];
  user: ShellUser;
};

const Ctx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: ReactNode }) {
  return <Ctx value={value}>{children}</Ctx>;
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}

export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(Ctx);
}
