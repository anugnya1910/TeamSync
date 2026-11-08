import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const hasSupabase = process.env.E2E_SUPABASE === "1";

/** Asserts 0 serious/critical axe violations (spec §I Accessibility). */
export async function expectNoSeriousA11yViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(summary, `axe violations on ${context}`).toEqual([]);
}

/** No horizontal page scroll (spec §F.5). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teamsync.test`;
}

export const E2E_PASSWORD = "Password123";

/** Signs up a brand-new user and completes onboarding; returns the workspace slug. */
export async function signUpAndOnboard(page: Page, opts: { name?: string; workspace?: string } = {}) {
  const email = uniqueEmail();
  const name = opts.name ?? "Ananya Tester";
  const workspace = opts.workspace ?? `E2E Team ${Math.random().toString(36).slice(2, 7)}`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel("Workspace name").fill(workspace);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByRole("button", { name: /go to dashboard/i }).click();
  await page.waitForURL(/\/w\/[a-z0-9-]+$/);
  const slug = new URL(page.url()).pathname.split("/")[2]!;
  return { email, password: E2E_PASSWORD, slug, name, workspace };
}
