import { z } from "zod";

/**
 * Public (browser-safe) environment. Every key is referenced statically so Next.js can inline it.
 * Server-only secrets live in `env.server.ts`, which is guarded by `server-only`.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v === "true"),
});

export type ClientEnv = z.infer<typeof clientSchema>;

function parseClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
    NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `TeamSync: invalid public environment variables.\n${issues}\nCopy .env.example to .env.local and fill it in.`,
    );
  }
  return parsed.data;
}

export const clientEnv: ClientEnv = parseClientEnv();
