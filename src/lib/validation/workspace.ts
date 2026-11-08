import { z } from "zod";

export const SLUG_REGEX = /^[a-z0-9-]{3,40}$/;
export const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_REGEX, "Use 3–40 lowercase letters, numbers or hyphens");

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_REGEX, "Use 3–20 lowercase letters, numbers or underscores");

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters")
  .max(60, "Use at most 60 characters");

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: slugSchema,
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export function isValidSlug(value: string): boolean {
  return SLUG_REGEX.test(value);
}

export function isValidHandle(value: string): boolean {
  return HANDLE_REGEX.test(value);
}
