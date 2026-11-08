import { expect, type Browser, type Page } from "@playwright/test";
import { E2E_PASSWORD, uniqueEmail } from "./helpers";

/** Opens the "New project" dialog from the sidebar/top bar and creates a project. */
export async function createProject(page: Page, slug: string, opts: { name: string; key: string; template?: "Blank" | "College Project" | "Event Planning" }) {
  await page.goto(`/w/${slug}/projects`);
  await page.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Name").fill(opts.name);
  await dialog.getByLabel("Key").fill(opts.key);
  if (opts.template) await dialog.getByRole("radio", { name: new RegExp(opts.template) }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(new RegExp(`/w/${slug}/p/${opts.key}$`));
}

/** Creates an invite link as the current (admin) user and returns its URL. */
export async function createInviteLink(page: Page, slug: string, maxUses = 5) {
  await page.goto(`/w/${slug}/members`);
  await page.getByRole("button", { name: "Invite people" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Max uses").fill(String(maxUses));
  await dialog.getByRole("button", { name: "Create link" }).click();
  const url = await dialog.getByTestId("invite-url").inputValue();
  await dialog.getByRole("button", { name: "Done" }).click();
  return url;
}

/** New browser context: sign up via the invite link and join the workspace. */
export async function joinViaInvite(browser: Browser, inviteUrl: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const path = new URL(inviteUrl).pathname;
  await page.goto(path);
  await page.getByRole("link", { name: "Sign up to join" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(uniqueEmail("joiner"));
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => u.pathname === path);
  await page.getByRole("button", { name: "Join workspace" }).click();
  await page.waitForURL(/\/w\/[a-z0-9-]+$/);
  return { context, page };
}

/** Adds a task with the column quick-add on the board. */
export async function quickAdd(page: Page, column: string, title: string) {
  const col = page.getByRole("region", { name: new RegExp(`^${column} column`) });
  await col.getByRole("button", { name: "Add task" }).click();
  const input = page.getByLabel(`New task in ${column}`);
  await input.fill(title);
  await input.press("Enter");
  await expect(card(page, title)).toBeVisible();
}

/** Board card by title (sortable items carry aria-label "KEY-n: title"). */
export function card(page: Page, title: string) {
  return page.locator(`li[aria-label$=": ${title}"]`);
}
