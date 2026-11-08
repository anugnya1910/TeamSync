import type { Database, TablesInsert } from "@/types/database";

type TableName = keyof Database["public"]["Tables"];

/**
 * Columns that BEFORE INSERT triggers fill (and overwrite) server-side — clients must never send
 * them (spec §D.5 "never trusted from the client"). The generated Insert types still mark them
 * required because they are NOT NULL without a column default.
 */
type ServerFilled = {
  tasks: "workspace_id" | "number" | "position";
  milestones: "workspace_id";
  labels: "workspace_id";
  saved_views: "workspace_id";
  comments: "project_id" | "workspace_id";
  task_assignees: "project_id" | "workspace_id";
  task_labels: "project_id" | "workspace_id";
  attachments: "project_id" | "workspace_id";
  team_members: "workspace_id";
  project_members: "workspace_id";
};

type Filled<T extends TableName> = T extends keyof ServerFilled ? ServerFilled[T] : never;

/** Builds an insert payload without the trigger-filled columns, typed against the table. */
export function clientInsert<T extends TableName>(
  _table: T,
  row: Omit<TablesInsert<T>, Filled<T>>,
): TablesInsert<T> {
  return row as TablesInsert<T>;
}
