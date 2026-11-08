import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath (open-redirect guard)", () => {
  it.each([
    ["/w/acme", "/w/acme"],
    ["/w/acme/projects?tab=1#x", "/w/acme/projects?tab=1#x"],
    ["/settings/profile", "/settings/profile"],
    ["/onboarding", "/onboarding"],
  ])("allows relative path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.com",
    "http://evil.com/w/acme",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "%2F%2Fevil.com",
    "/%2F%2Fevil.com/../",
    "evil.com",
    "w/acme",
    "/login",
    "/signup?next=/x",
    "/w/acme\u0000",
    "",
    "   ",
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBe("/app");
  });

  it("returns the fallback for null/undefined", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
  });

  it("normalises dot segments without leaving the origin", () => {
    expect(safeNextPath("/w/acme/../other")).toBe("/w/other");
  });
});
