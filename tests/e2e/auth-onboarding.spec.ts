import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, hasSupabase, signUpAndOnboard } from "./helpers";

test.describe("sign up → onboarding → dashboard → logout → login", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");

  test("full journey returns to the same workspace", async ({ page, isMobile }) => {
    const { email, password, slug, workspace } = await signUpAndOnboard(page, { name: "Ananya Rao" });

    // Dashboard shows real data only.
    await expect(page.getByRole("heading", { level: 1, name: /good (morning|afternoon|evening), ananya/i })).toBeVisible();
    await expect(page.getByRole("main").getByText(workspace, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Getting started" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "dashboard");

    // Session persists across reload.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/w/${slug}$`));

    // Logout via the user menu.
    if (isMobile) {
      await page.getByRole("button", { name: "Menu" }).click();
    }
    await page.getByRole("button", { name: /ananya rao/i }).first().click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL((u) => u.pathname === "/");

    // Protected route now redirects with next.
    await page.goto(`/w/${slug}/members`);
    await expect(page).toHaveURL(/\/login\?next=/);

    // Login with next honoured.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(new RegExp(`/w/${slug}/members$`));
    await expect(page.getByText("You", { exact: true })).toBeVisible();

    // Login without next → resolver returns to last workspace.
    await page.goto("/app");
    await page.waitForURL(new RegExp(`/w/${slug}$`));
  });

  test("onboarding page is accessible", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("A11y Tester");
    await page.getByLabel("Email").fill(`a11y-${Date.now()}@teamsync.test`);
    await page.getByLabel("Password", { exact: true }).fill("Password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await expectNoSeriousA11yViolations(page, "onboarding");
  });

  test("onboarding cannot be skipped without a workspace", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Skipper");
    await page.getByLabel("Email").fill(`skip-${Date.now()}@teamsync.test`);
    await page.getByLabel("Password", { exact: true }).fill("Password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("a non-member gets a 404 for someone else's workspace", async ({ browser }) => {
    const a = await browser.newPage();
    const { slug } = await signUpAndOnboard(a);
    await a.close();
    const b = await browser.newPage();
    await signUpAndOnboard(b);
    const res = await b.goto(`/w/${slug}`);
    expect(res?.status()).toBe(404);
    await expect(b.getByText(/couldn't find that/i)).toBeVisible();
    await b.close();
  });
});
