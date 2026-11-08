import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type ServerSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client for Server Components, Server Actions and Route Handlers. Uses the user's
 * session cookies, so every query runs under RLS as that user.
 */
export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are read-only there. The proxy refreshes
            // the session on every navigation, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Current authenticated user id for this request (deduplicated per render with React `cache`).
 * Uses `getClaims()`, which verifies the JWT, rather than trusting `getSession()`.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});
