import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, hasSupabase, signUpAndOnboard } from "./helpers";

test.describe("responsive — 360×740", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page);
    });
  }

  test("app shell: no overflow, bottom nav visible, sidebar hidden", async ({ page }) => {
    test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
    const { slug } = await signUpAndOnboard(page);
    for (const path of [`/w/${slug}`, `/w/${slug}/members`, "/settings/profile", "/settings/preferences"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
    await page.goto(`/w/${slug}`);
    await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeHidden();
  });
});

test.describe("responsive — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("sidebar visible, bottom nav hidden", async ({ page }) => {
    test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
    const { slug } = await signUpAndOnboard(page);
    await page.goto(`/w/${slug}`);
    await expect(page.getByRole("complementary", { name: "Sidebar" })).toBeVisible();
    await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
  });
});
