import { formatInTimeZone } from "date-fns-tz";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily jobs (spec §C.8, §J.5). Called by .github/workflows/daily.yml with CRON_SECRET.
 * Idempotent per date: re-running creates no duplicate notifications. Also keeps the free
 * Supabase project active. The service-role client is used ONLY here.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const date = formatInTimeZone(new Date(), serverEnv.APP_DEFAULT_TZ, "yyyy-MM-dd");
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("generate_due_notifications", { p_date: date });
    if (error) throw error;
    const counts = data?.[0] ?? { due_soon: 0, overdue: 0 };
    const extra = await runPhaseExtensions(admin, date);
    logger.info("cron daily done", { date, ...counts, ...extra });
    return NextResponse.json({ date, notifications: counts, ...extra }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    logger.error("cron daily failed", { date, message: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: "job failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}

/** Extension point for later phases (Pulse snapshots, pruning). */
async function runPhaseExtensions(_admin: ReturnType<typeof createAdminClient>, _date: string): Promise<Record<string, unknown>> {
  return {};
}
