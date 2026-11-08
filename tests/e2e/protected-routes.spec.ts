import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

test.describe("protected routes (anonymous)", () => {
  for (const path of ["/w/x", "/w/acme/members", "/onboarding", "/settings/profile", "/app"]) {
    test(`${path} redirects to login with a safe next`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === path);
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    });
  }

  test("public routes stay public", async ({ page }) => {
    for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    }
  });

  test("unknown invite token shows a helpful message", async ({ page }) => {
    await page.goto("/invite/AbCdEfGhIjKlMnOpQrStUv");
    await expect(page.getByRole("heading", { name: "Invite not found" })).toBeVisible();
  });

  test("auth screens have no serious accessibility violations", async ({ page }) => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      await page.goto(path);
      await expectNoSeriousA11yViolations(page, path);
    }
  });

  test("login form validates inline", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });
});
