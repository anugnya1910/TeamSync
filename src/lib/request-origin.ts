import "server-only";
import { headers } from "next/headers";
import { clientEnv } from "@/lib/env";

/**
 * Base URL for auth redirects. Prefers the configured NEXT_PUBLIC_APP_URL; falls back to the
 * request's own origin only when it matches the Host header (so preview deployments work and a
 * spoofed Origin header cannot redirect elsewhere).
 */
export async function getAppOrigin(): Promise<string> {
  const configured = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host) {
    try {
      const u = new URL(origin);
      if (u.host === host && !configured.includes(u.host)) return u.origin;
    } catch {
      // ignore malformed origin
    }
  }
  return configured;
}
