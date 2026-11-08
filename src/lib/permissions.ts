import type { ProjectRole, ProjectStatus, WorkspaceRole } from "@/lib/domain";

/** Effective permissions (spec §B.0). The database enforces these; the UI only reflects them. */
export type Permissions = {
  workspaceRole: WorkspaceRole | null;
  projectRole: ProjectRole | null;
  isWorkspaceAdmin: boolean;
  isOwner: boolean;
  canManageWorkspace: boolean;
  canInvite: boolean;
  canManageTeams: boolean;
  canCreateProjects: boolean;
  canEditProject: boolean;
  canEditTasks: boolean;
  canDeleteAnyTask: boolean;
  canComment: boolean;
  canOverrideBlocked: boolean;
  readOnlyReason: string | null;
};

export function derivePermissions(input: {
  workspaceRole: WorkspaceRole | null;
  projectRole?: ProjectRole | null;
  projectStatus?: ProjectStatus | null;
  isProjectContext?: boolean;
}): Permissions {
  const ws = input.workspaceRole;
  const isWorkspaceAdmin = ws === "owner" || ws === "admin";
  // Workspace owners/admins act as lead on every project.
  const projectRole: ProjectRole | null = isWorkspaceAdmin ? "lead" : (input.projectRole ?? null);
  const archived = input.projectStatus === "archived";
  const isLead = projectRole === "lead";
  const canEditTasks = !archived && (projectRole === "lead" || projectRole === "contributor");

  let readOnlyReason: string | null = null;
  if (input.isProjectContext) {
    if (archived) readOnlyReason = "This project is archived, so it is read-only.";
    else if (!canEditTasks) readOnlyReason = "You have view-only access to this project.";
  }

  return {
    workspaceRole: ws,
    projectRole,
    isWorkspaceAdmin,
    isOwner: ws === "owner",
    canManageWorkspace: isWorkspaceAdmin,
    canInvite: isWorkspaceAdmin,
    canManageTeams: isWorkspaceAdmin,
    canCreateProjects: ws === "owner" || ws === "admin" || ws === "member",
    canEditProject: isLead,
    canEditTasks,
    canDeleteAnyTask: isLead && !archived,
    canComment: ws !== null && (input.isProjectContext ? projectRole !== null || ws !== "guest" : true),
    canOverrideBlocked: isLead,
    readOnlyReason,
  };
}

/** Whether the user may delete a specific task (lead: any; contributor: their own). */
export function canDeleteTask(p: Permissions, createdBy: string | null, userId: string): boolean {
  return p.canDeleteAnyTask || (p.canEditTasks && createdBy === userId);
}
