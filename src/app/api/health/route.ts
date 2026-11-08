import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

/** Liveness probe: app + database reachability. Returns no data beyond status and time. */
export async function GET() {
  const supabase = createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const started = Date.now();
  const { error } = await supabase.rpc("health_check");
  const body = { status: error ? "degraded" : "ok", db: error ? "error" : "ok", time: new Date().toISOString(), latencyMs: Date.now() - started };
  return NextResponse.json(body, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
