/** Uniform Server Action result shape and Postgres error mapping (spec §E). */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "TASK_BLOCKED"
  | "CYCLE_DETECTED"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): { ok: false; error: ActionError } => ({ ok: false, error: { code, message, fieldErrors } });

export type PgErrorLike = { code?: string | null; message?: string | null; details?: string | null };

const PREFIXED: ErrorCode[] = [
  "TASK_BLOCKED",
  "CYCLE_DETECTED",
  "CONFLICT",
  "VALIDATION",
  "FORBIDDEN",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "RATE_LIMITED",
];

/** Maps a PostgREST / Postgres error to a safe ActionError. Never leaks raw SQL. */
export function mapPgError(error: PgErrorLike | null | undefined): ActionError {
  if (!error) return { code: "INTERNAL", message: "Something went wrong." };
  const raw = error.message ?? "";

  for (const code of PREFIXED) {
    const prefix = `${code}:`;
    const idx = raw.indexOf(prefix);
    if (idx !== -1) {
      const message = raw.slice(idx + prefix.length).trim() || defaultMessage(code);
      return { code, message };
    }
  }

  switch (error.code) {
    case "42501":
      return { code: "FORBIDDEN", message: defaultMessage("FORBIDDEN") };
    case "23505":
      return { code: "CONFLICT", message: defaultMessage("CONFLICT") };
    case "23503":
    case "23514":
    case "22P02":
    case "22001":
    case "23502":
      return { code: "VALIDATION", message: defaultMessage("VALIDATION") };
    case "PGRST116":
    case "P0002":
      return { code: "NOT_FOUND", message: defaultMessage("NOT_FOUND") };
    default:
      return { code: "INTERNAL", message: defaultMessage("INTERNAL") };
  }
}

export function defaultMessage(code: ErrorCode): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "Please sign in to continue.";
    case "FORBIDDEN":
      return "You don't have permission to do that.";
    case "NOT_FOUND":
      return "We couldn't find that.";
    case "VALIDATION":
      return "Please check the values you entered.";
    case "CONFLICT":
      return "That conflicts with an existing item.";
    case "TASK_BLOCKED":
      return "This task is blocked by unfinished work.";
    case "CYCLE_DETECTED":
      return "That dependency would create a cycle.";
    case "RATE_LIMITED":
      return "You're doing that too often. Please try again later.";
    case "AI_UNAVAILABLE":
      return "The AI assistant is unavailable right now.";
    default:
      return "Something went wrong. Please try again.";
  }
}
