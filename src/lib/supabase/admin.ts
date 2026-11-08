import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { requireServerSecret } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client — BYPASSES RLS. Reserved for `/api/cron/*` (authenticated with CRON_SECRET)
 * and the account-deletion flow. Never import it from components or files with 'use client'
 * (enforced by ESLint `no-restricted-imports`).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    requireServerSecret("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
