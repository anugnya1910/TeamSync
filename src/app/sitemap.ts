import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Public routes only. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/signup`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.4 },
  ];
}
