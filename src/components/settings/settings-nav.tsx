"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ACCOUNT_SETTINGS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Left sub-nav on desktop; a native select on mobile (spec §F.10 Settings). */
export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      <div className="md:hidden">
        <label htmlFor="settings-section" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-section"
          value={ACCOUNT_SETTINGS.find((s) => pathname.startsWith(s.href))?.href ?? ACCOUNT_SETTINGS[0].href}
          onChange={(e) => router.push(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
        >
          {ACCOUNT_SETTINGS.map((s) => (
            <option key={s.href} value={s.href}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Account settings" className="hidden md:block">
        <p className="mb-2 px-2.5 text-meta tracking-wide text-muted-foreground uppercase">Account</p>
        <ul className="space-y-0.5">
          {ACCOUNT_SETTINGS.map((s) => {
            const active = pathname.startsWith(s.href);
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-2.5 py-2 text-sm font-medium",
                    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
