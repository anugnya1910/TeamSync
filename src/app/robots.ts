import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: ["/w/", "/app", "/onboarding", "/settings", "/invite/", "/api/", "/auth/", "/dev/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
