"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { derivePermissions, type Permissions } from "@/lib/permissions";
import type { ProjectBundle, ProjectMember } from "@/lib/data/project";

export type ProjectContextValue = ProjectBundle & {
  permissions: Permissions;
  memberById: Map<string, ProjectMember>;
  basePath: string;
};

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ bundle, children }: { bundle: ProjectBundle; children: ReactNode }) {
  const { role, workspace } = useWorkspace();
  const value = useMemo<ProjectContextValue>(() => {
    const permissions = derivePermissions({
      workspaceRole: role,
      projectRole: bundle.myRole,
      projectStatus: bundle.project.status,
      isProjectContext: true,
    });
    return {
      ...bundle,
      permissions,
      memberById: new Map(bundle.members.map((m) => [m.user_id, m])),
      basePath: `/w/${workspace.slug}/p/${bundle.project.key}`,
    };
  }, [bundle, role, workspace.slug]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useProject(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject must be used inside ProjectProvider");
  return v;
}

export function useOptionalProject(): ProjectContextValue | null {
  return useContext(Ctx);
}
