import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, resetPasswordSchema, signupSchema } from "@/lib/validation/auth";
import { preferencesSchema, profileSettingsSchema } from "@/lib/validation/profile";
import {
  createWorkspaceSchema,
  handleSchema,
  isValidHandle,
  isValidSlug,
  slugSchema,
} from "@/lib/validation/workspace";

describe("slug validation", () => {
  it.each(["abc", "cbit-capstone", "team-2", "a".repeat(40), "123"])("accepts %s", (s) => {
    expect(isValidSlug(s)).toBe(true);
    expect(slugSchema.safeParse(s).success).toBe(true);
  });
  it.each(["ab", "a".repeat(41), "Has Caps", "under_score", "spaces here", "émoji", ""])(
    "rejects %j",
    (s) => {
      expect(isValidSlug(s)).toBe(false);
    },
  );
  it("schema lower-cases and trims", () => {
    expect(slugSchema.parse("  My-Team  ")).toBe("my-team");
  });
});

describe("handle validation", () => {
  it.each(["abc", "ananya_01", "a".repeat(20)])("accepts %s", (h) => {
    expect(isValidHandle(h)).toBe(true);
  });
  it.each(["ab", "a".repeat(21), "with-dash", "with space", "UPPER"])("rejects %j", (h) => {
    expect(isValidHandle(h)).toBe(false);
  });
  it("schema lower-cases", () => {
    expect(handleSchema.parse("Ananya_01")).toBe("ananya_01");
  });
});

describe("password policy (≥8, letter + number)", () => {
  it.each(["Password1", "abcdefg1", "12345678a"])("accepts %s", (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(true);
  });
  it.each(["short1", "allletters", "12345678", ""])("rejects %j", (p) => {
    expect(passwordSchema.safeParse(p).success).toBe(false);
  });
});

describe("auth schemas", () => {
  it("signup requires a 1–80 char name", () => {
    expect(signupSchema.safeParse({ fullName: "", email: "a@b.co", password: "Password1" }).success).toBe(false);
    expect(
      signupSchema.safeParse({ fullName: "x".repeat(81), email: "a@b.co", password: "Password1" }).success,
    ).toBe(false);
    expect(signupSchema.safeParse({ fullName: "Ananya", email: "a@b.co", password: "Password1" }).success).toBe(true);
  });
  it("login does not apply strength rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("rejects invalid emails", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });
  it("reset requires matching passwords", () => {
    const r = resetPasswordSchema.safeParse({ password: "Password1", confirmPassword: "Password2" });
    expect(r.success).toBe(false);
  });
});

describe("workspace & profile schemas", () => {
  it("workspace name 2–60", () => {
    expect(createWorkspaceSchema.safeParse({ name: "A", slug: "abc" }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse({ name: "AB", slug: "abc" }).success).toBe(true);
  });
  it("profile requires a valid timezone and http(s) avatar", () => {
    const base = { fullName: "A", handle: "abc", jobTitle: "", timezone: "Asia/Kolkata", avatarUrl: "" };
    expect(profileSettingsSchema.safeParse(base).success).toBe(true);
    expect(profileSettingsSchema.safeParse({ ...base, timezone: "Mars/Base" }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ ...base, avatarUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("preferences accept only known themes and week starts", () => {
    const base = { theme: "dark", reducedMotion: false, weekStart: 1, weekendStreakProtection: true, showOnLeaderboard: true };
    expect(preferencesSchema.safeParse(base).success).toBe(true);
    expect(preferencesSchema.safeParse({ ...base, theme: "neon" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...base, weekStart: 3 }).success).toBe(false);
  });
});
