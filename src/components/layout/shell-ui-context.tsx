"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ComingSoonInfo = { title: string; description: string; phase: 2 | 3 | 4 };

type ShellUi = {
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  createWorkspaceOpen: boolean;
  setCreateWorkspaceOpen: (v: boolean) => void;
  comingSoon: ComingSoonInfo | null;
  showComingSoon: (info: ComingSoonInfo | null) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (v: boolean) => void;
  newTaskOpen: boolean;
  setNewTaskOpen: (v: boolean) => void;
};

const Ctx = createContext<ShellUi | null>(null);

/** UI-only state shared across the app shell (palette, dialogs, drawer). */
export function ShellUiProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [comingSoon, showComingSoon] = useState<ComingSoonInfo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const value = useMemo(
    () => ({
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      createWorkspaceOpen,
      setCreateWorkspaceOpen,
      comingSoon,
      showComingSoon,
      mobileMenuOpen,
      setMobileMenuOpen,
      newProjectOpen,
      setNewProjectOpen,
      newTaskOpen,
      setNewTaskOpen,
    }),
    [paletteOpen, shortcutsOpen, createWorkspaceOpen, comingSoon, mobileMenuOpen, newProjectOpen, newTaskOpen],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useShellUi(): ShellUi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShellUi must be used inside ShellUiProvider");
  return v;
}
