/** TanStack Query keys — single source of truth (PHASE_2 §5). */
export const qk = {
  projectTasks: (projectId: string) => ["tasks", projectId] as const,
  task: (taskId: string) => ["task", taskId] as const,
  taskComments: (taskId: string) => ["task-comments", taskId] as const,
  taskActivity: (taskId: string) => ["task-activity", taskId] as const,
  taskAttachments: (taskId: string) => ["task-attachments", taskId] as const,
  projectActivity: (projectId: string) => ["project-activity", projectId] as const,
  workspaceActivity: (workspaceId: string) => ["workspace-activity", workspaceId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
  unreadCount: (userId: string) => ["notifications-unread", userId] as const,
  search: (workspaceId: string, q: string) => ["search", workspaceId, q] as const,
  projectMembers: (projectId: string) => ["project-members", projectId] as const,
};
