import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseOrigin = (() => {
  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");
const isDev = process.env.NODE_ENV !== "production";
// Only force HTTPS (upgrade-insecure-requests, HSTS) when the app itself is served over HTTPS.
// WebKit applies upgrade-insecure-requests to http://localhost, which breaks local `next start`.
const isHttpsApp = (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");

/**
 * Content-Security-Policy (spec §H.1). Fonts are self-hosted by next/font, so only `self` is
 * needed for fonts. `unsafe-inline` for scripts is required by Next.js' inline bootstrap and
 * next-themes' no-flash script without a nonce; `unsafe-eval` only in development (HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.googleusercontent.com`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isHttpsApp ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isHttpsApp ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Cache Components is intentionally OFF: almost every route reads the Supabase session cookie,
  // and the classic dynamic-rendering model keeps auth-dependent pages simple and correct.
  // (Decision logged in docs/planning/IMPLEMENTATION_TRACKER.md §11.)
  cacheComponents: false,
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: new URL(supabaseOrigin).protocol.replace(":", "") as "http" | "https",
            hostname: new URL(supabaseOrigin).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
