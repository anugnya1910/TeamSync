import { describe, expect, it } from "vitest";
import { defaultMessage, mapPgError } from "@/lib/action-result";
import { GENERIC_LOGIN_ERROR, mapAuthError } from "@/lib/auth/errors";
import { matchesCombo, isTypingTarget } from "@/hooks/use-hotkeys";
import { activeNavKey, workspaceHref } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { contrastRatio, hexToRgb, rgbStringToHex } from "@/lib/utils/contrast";
import { firstName, greetingFor, initials, longDate, pluralize } from "@/lib/utils/format";
import { parseInviteToken } from "@/lib/utils/invite";
import { slugify, suggestSlug } from "@/lib/utils/slug";
import { isValidTimeZone, listTimeZones } from "@/lib/utils/timezones";

describe("cn", () => {
  it("merges classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("mapAuthError", () => {
  it("never reveals whether an email exists", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toBe(GENERIC_LOGIN_ERROR);
    expect(mapAuthError({ code: "user_not_found" })).toBe(GENERIC_LOGIN_ERROR);
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe(GENERIC_LOGIN_ERROR);
  });
  it("maps email rate limits to a try-later message", () => {
    expect(mapAuthError({ code: "over_email_send_rate_limit" })).toMatch(/wait/i);
    expect(mapAuthError({ message: "email rate limit exceeded" })).toMatch(/wait/i);
    expect(mapAuthError({ status: 429 })).toMatch(/wait/i);
  });
  it("maps expired links and unconfirmed emails", () => {
    expect(mapAuthError({ code: "otp_expired" })).toMatch(/expired/i);
    expect(mapAuthError({ code: "email_not_confirmed" })).toMatch(/confirm/i);
  });
  it("falls back to a generic message", () => {
    expect(mapAuthError({ code: "something_new" })).toMatch(/something went wrong/i);
    expect(mapAuthError(null)).toMatch(/something went wrong/i);
  });
});

describe("mapPgError", () => {
  it("maps SQLSTATE codes", () => {
    expect(mapPgError({ code: "42501" }).code).toBe("FORBIDDEN");
    expect(mapPgError({ code: "23505" }).code).toBe("CONFLICT");
    expect(mapPgError({ code: "23514" }).code).toBe("VALIDATION");
    expect(mapPgError({ code: "23503" }).code).toBe("VALIDATION");
    expect(mapPgError({ code: "PGRST116" }).code).toBe("NOT_FOUND");
    expect(mapPgError({ code: "XX000", message: "relation secret_table" }).code).toBe("INTERNAL");
  });
  it("maps prefixed P0001 messages and strips the prefix", () => {
    expect(mapPgError({ code: "P0001", message: "CONFLICT: that workspace URL is already taken" })).toEqual({
      code: "CONFLICT",
      message: "that workspace URL is already taken",
    });
    expect(mapPgError({ code: "P0001", message: "TASK_BLOCKED: blocked by TS-3" }).code).toBe("TASK_BLOCKED");
  });
  it("never leaks raw SQL for unknown errors", () => {
    expect(mapPgError({ code: "42P01", message: 'relation "x" does not exist' }).message).toBe(
      defaultMessage("INTERNAL"),
    );
  });
});

describe("slug helpers", () => {
  it("slugify", () => {
    expect(slugify("CBIT Capstone 2026!")).toBe("cbit-capstone-2026");
    expect(slugify("  Café  Déjà vu ")).toBe("cafe-deja-vu");
    expect(slugify("---")).toBe("");
    expect(slugify("x".repeat(60)).length).toBeLessThanOrEqual(40);
  });
  it("suggestSlug stays valid", () => {
    expect(suggestSlug("team")).toBe("team-2");
    expect(suggestSlug("a".repeat(40), 3)).toHaveLength(40);
    expect(suggestSlug("a".repeat(40), 3).endsWith("-3")).toBe(true);
  });
});

describe("parseInviteToken", () => {
  const token = "AbCdEfGhIjKlMnOpQrStUv";
  it("extracts from URLs and bare tokens", () => {
    expect(parseInviteToken(`https://teamsync.app/invite/${token}`)).toBe(token);
    expect(parseInviteToken(`http://localhost:3000/invite/${token}?x=1`)).toBe(token);
    expect(parseInviteToken(`  ${token}  `)).toBe(token);
  });
  it("rejects junk", () => {
    expect(parseInviteToken("")).toBeNull();
    expect(parseInviteToken("short")).toBeNull();
    expect(parseInviteToken("https://evil.com/<script>")).toBeNull();
  });
});

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#FFFFFF", "#4F46E5")).toBeGreaterThan(4.5);
  });
  it("parses colours", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(() => hexToRgb("nope")).toThrow();
    expect(rgbStringToHex("rgb(79, 70, 229)")).toBe("#4F46E5");
    expect(rgbStringToHex("transparent")).toBeNull();
  });
});

describe("format helpers", () => {
  it("initials and first name", () => {
    expect(initials("Ananya Rao")).toBe("AR");
    expect(initials("rahul")).toBe("R");
    expect(initials("  ")).toBe("?");
    expect(firstName("Murari Krishna")).toBe("Murari");
    expect(firstName("")).toBe("there");
  });
  it("greets by the hour in the user's timezone", () => {
    const d = new Date("2026-11-08T03:30:00Z"); // 09:00 IST, 03:30 London
    expect(greetingFor(d, "Asia/Kolkata")).toBe("Good morning");
    expect(greetingFor(d, "Europe/London")).toBe("Good evening");
    expect(greetingFor(new Date("2026-11-08T09:30:00Z"), "Asia/Kolkata")).toBe("Good afternoon");
  });
  it("formats long dates in timezone", () => {
    expect(longDate(new Date("2026-11-08T03:30:00Z"), "Asia/Kolkata")).toBe("Sunday, 8 November");
  });
  it("pluralize", () => {
    expect(pluralize(1, "member")).toBe("1 member");
    expect(pluralize(3, "member")).toBe("3 members");
  });
});

describe("timezones", () => {
  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(listTimeZones()).toContain("UTC");
  });
});

describe("navigation", () => {
  it("builds workspace hrefs and detects the active item", () => {
    expect(workspaceHref("acme")).toBe("/w/acme");
    expect(workspaceHref("acme", "members")).toBe("/w/acme/members");
    expect(activeNavKey("/w/acme", "acme")).toBe("home");
    expect(activeNavKey("/w/acme/members", "acme")).toBe("members");
    expect(activeNavKey("/w/acme/p/TS/board", "acme")).toBe("projects");
    expect(activeNavKey("/w/acme/unknown", "acme")).toBeNull();
  });
});

describe("hotkeys", () => {
  const ev = (key: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  });
  it("matches mod combos on both platforms", () => {
    expect(matchesCombo(ev("k", { metaKey: true }), "mod+k")).toBe(true);
    expect(matchesCombo(ev("k", { ctrlKey: true }), "mod+k")).toBe(true);
    expect(matchesCombo(ev("k"), "mod+k")).toBe(false);
    expect(matchesCombo(ev("?", { shiftKey: true }), "?")).toBe(true);
    expect(matchesCombo(ev("/", { ctrlKey: true }), "/")).toBe(false);
  });
  it("detects typing targets", () => {
    const input = document.createElement("input");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
