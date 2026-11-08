import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

test.describe("landing page", () => {
  test("renders hero, sections and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /projects that tell you how they're doing/i })).toBeVisible();
    for (const id of ["how-it-works", "features", "pulse", "faq"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.getByText("Built for academic purposes.")).toBeVisible();
    await expect(page.getByText("Illustration", { exact: true })).toBeVisible();
  });

  test("primary CTA navigates to sign up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /start free/i }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("Pulse demo recomputes when a slider changes", async ({ page }) => {
    await page.goto("/#pulse");
    const score = page.getByTestId("demo-score");
    const before = await score.textContent();
    const slider = page.getByRole("slider", { name: "Overdue work" });
    await slider.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("PageUp");
    await expect(score).not.toHaveText(before ?? "");
    const after = Number((await score.textContent())?.match(/\d+/)?.[0]);
    const prev = Number(before?.match(/\d+/)?.[0]);
    expect(after).toBeLessThan(prev);
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yViolations(page, "landing");
  });

  test("serves SEO files", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Disallow: /w/");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/signup");
  });

  test("sends security headers", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });
});
