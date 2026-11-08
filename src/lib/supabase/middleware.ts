import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { safeNextPath } from "@/lib/auth/safe-next";

/** Route prefixes that require a signed-in user (spec §B.1, PHASE_1 Step 3). */
const PROTECTED = [/^\/w(\/|$)/, /^\/onboarding(\/|$)/, /^\/settings(\/|$)/, /^\/app(\/|$)/, /^\/invite\/[^/]+\/accept(\/|$)/];
/** Auth pages a signed-in user should be bounced away from. */
const AUTH_ONLY = [/^\/login\/?$/, /^\/signup\/?$/];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED.some((re) => re.test(pathname));
}

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY.some((re) => re.test(pathname));
}

/**
 * Refreshes the Supabase session cookie and applies route guards. Runs in `src/proxy.ts`.
 * Keep this light: one auth call, no database queries.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Misconfigured deployment: fail closed for protected routes.
    if (isProtectedPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not run code between createServerClient and getClaims (session refresh happens here).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectWithCookies = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!isSignedIn && isProtectedPath(pathname)) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", safeNextPath(pathname + search));
    return redirectWithCookies(target);
  }

  if (isSignedIn && isAuthOnlyPath(pathname)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/app");
    return redirectWithCookies(new URL(next, request.url));
  }

  return response;
}
