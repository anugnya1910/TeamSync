import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | undefined;

/** Browser Supabase client (anon key + user JWT from cookies). Singleton per tab. */
export function createClient(): TypedSupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return browserClient;
}
