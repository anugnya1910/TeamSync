import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Secrets are optional at parse time because they are only needed by
 * specific routes (cron, AI); `requireServerSecret` fails fast with a clear message on use.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters").optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(0).max(100000).default(200),
  APP_DEFAULT_TZ: z.string().min(1).default("Asia/Kolkata"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

const emptyToUndefined = (v: string | undefined) => (v === undefined || v === "" ? undefined : v);

function parseServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
    CRON_SECRET: emptyToUndefined(process.env.CRON_SECRET),
    GEMINI_API_KEY: emptyToUndefined(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: emptyToUndefined(process.env.GEMINI_MODEL),
    AI_GLOBAL_DAILY_LIMIT: emptyToUndefined(process.env.AI_GLOBAL_DAILY_LIMIT),
    APP_DEFAULT_TZ: emptyToUndefined(process.env.APP_DEFAULT_TZ),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`TeamSync: invalid server environment variables.\n${issues}`);
  }
  return parsed.data;
}

export const serverEnv: ServerEnv = parseServerEnv();

export function requireServerSecret<K extends "SUPABASE_SERVICE_ROLE_KEY" | "CRON_SECRET">(
  key: K,
): string {
  const value = serverEnv[key];
  if (!value) {
    throw new Error(`TeamSync: ${key} is not configured on the server.`);
  }
  return value;
}
