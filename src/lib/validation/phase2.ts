import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { slugSchema, workspaceNameSchema } from "./workspace";

export const uuidSchema = z.uuid({ message: "Invalid id" });
const workspaceRole = z.enum(["admin", "member", "guest"]);
export const projectRoleSchema = z.enum(["lead", "contributor", "viewer"]);
export const taskStatusSchema = z.enum(TASK_STATUSES as [string, ...string[]]) as z.ZodType<(typeof TASK_STATUSES)[number]>;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES as [string, ...string[]]) as z.ZodType<(typeof TASK_PRIORITIES)[number]>;
export const COLOR_TOKENS = ["indigo", "coral", "violet", "green", "amber", "red", "sky", "slate"] as const;
export const colorSchema = z.enum(COLOR_TOKENS);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
const optionalDate = z.union([isoDate, z.literal(""), z.null()]).transform((v) => (v ? v : null));

export const createInviteSchema = z.object({
  workspaceId: uuidSchema,
  role: workspaceRole,
  email: z.union([z.literal(""), z.email({ message: "Enter a valid email" })]).optional().transform((v) => v || null),
  maxUses: z.coerce.number().int().min(1).max(1000),
  expiresInDays: z.coerce.number().int().min(1).max(30),
});

export const changeRoleSchema = z.object({ workspaceId: uuidSchema, userId: uuidSchema, role: workspaceRole });
export const memberRefSchema = z.object({ workspaceId: uuidSchema, userId: uuidSchema });

export const updateWorkspaceSchema = z.object({
  workspaceId: uuidSchema,
  name: workspaceNameSchema,
  slug: slugSchema,
});

export const workspaceFeaturesSchema = z.object({
  workspaceId: uuidSchema,
  aiEnabled: z.boolean(),
  gamificationEnabled: z.boolean(),
  aiDailyLimit: z.coerce.number().int().min(0).max(1000),
});

export const deleteWorkspaceSchema = z.object({ workspaceId: uuidSchema, confirmSlug: z.string().min(1) });

export const teamSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(40, "Use at most 40 characters"),
  color: colorSchema,
  icon: z.string().regex(/^[a-z0-9-]{1,32}$/),
});

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}$/, "Use 2–5 letters");

export const createProjectSchema = z
  .object({
    workspaceId: uuidSchema,
    name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Use at most 80 characters"),
    key: projectKeySchema,
    description: z.string().max(10000).optional().default(""),
    icon: z.string().max(16).optional().default(""),
    color: colorSchema.default("indigo"),
    visibility: z.enum(["workspace", "private"]).default("workspace"),
    startDate: optionalDate.default(null),
    targetDate: optionalDate.default(null),
    teamId: z.union([uuidSchema, z.literal(""), z.null()]).optional().transform((v) => v || null),
    template: z.enum(["blank", "college_project", "event_planning"]).default("blank"),
  })
  .refine((v) => !v.startDate || !v.targetDate || v.targetDate >= v.startDate, {
    path: ["targetDate"],
    message: "Target date must be on or after the start date",
  });

export const updateProjectSchema = z
  .object({
    projectId: uuidSchema,
    name: z.string().trim().min(2).max(80),
    description: z.string().max(10000),
    icon: z.string().max(16),
    color: colorSchema,
    visibility: z.enum(["workspace", "private"]),
    status: z.enum(["planning", "active", "on_hold", "completed", "archived"]),
    startDate: optionalDate,
    targetDate: optionalDate,
  })
  .refine((v) => !v.startDate || !v.targetDate || v.targetDate >= v.startDate, {
    path: ["targetDate"],
    message: "Target date must be on or after the start date",
  });

export const milestoneSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().max(2000).optional().default(""),
  dueDate: optionalDate.default(null),
});

export const labelSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(1, "Name is required").max(30),
  color: colorSchema,
});

export const createTaskSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1, "Title is required").max(200, "Use at most 200 characters"),
  description: z.string().max(20000).optional().default(""),
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("none"),
  dueDate: optionalDate.default(null),
  startDate: optionalDate.default(null),
  effort: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5), z.literal(8), z.literal(13), z.null()]).default(null),
  milestoneId: z.union([uuidSchema, z.null()]).default(null),
  parentTaskId: z.union([uuidSchema, z.null()]).default(null),
  assigneeIds: z.array(uuidSchema).max(20).default([]),
  labelIds: z.array(uuidSchema).max(20).default([]),
});

export const commentSchema = z.object({
  taskId: uuidSchema,
  body: z.string().trim().min(1, "Write something first").max(10000, "Comments are limited to 10,000 characters"),
});

export const notificationPrefsSchema = z.record(z.string(), z.boolean());
export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
