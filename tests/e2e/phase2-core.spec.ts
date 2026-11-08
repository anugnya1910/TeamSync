import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, expectNoSeriousA11yViolations, hasSupabase, signUpAndOnboard } from "./helpers";
import { card, createInviteLink, createProject, joinViaInvite, quickAdd } from "./phase2-helpers";

test.describe("Phase 2 — core collaboration", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "desktop journeys; mobile covered separately");

  test("1 invite link → second user joins → appears in members", async ({ page, browser }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Owner One" });
    const url = await createInviteLink(page, slug);
    const joiner = await joinViaInvite(browser, url, "Jay Joiner");
    await page.goto(`/w/${slug}/members`);
    await expect(page.getByRole("list", { name: "Members" }).getByText("Jay Joiner")).toBeVisible();
    await joiner.context.close();
  });

  test("2 template project creates milestones and task titles", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page);
    await createProject(page, slug, { name: "Capstone", key: "CAP", template: "College Project" });
    for (const m of ["Research", "Build", "Test", "Report"]) {
      await expect(page.getByRole("region", { name: "Milestones" }).getByText(m, { exact: true })).toBeVisible();
    }
    await page.goto(`/w/${slug}/p/CAP/list?group=none`);
    await expect(page.getByRole("button", { name: "Define the problem statement" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "list");
  });

  test("3+4 quick add, keyboard DnD persists, realtime reaches a second session", async ({ page, browser }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Board Owner" });
    await createProject(page, slug, { name: "Realtime", key: "RT" });
    const url = await createInviteLink(page, slug);
    const other = await joinViaInvite(browser, url, "Second Viewer");

    await page.goto(`/w/${slug}/p/RT/board`);
    await quickAdd(page, "To do", "Move me");
    await other.page.goto(`/w/${slug}/p/RT/board`);
    await expect(card(other.page, "Move me")).toBeVisible();
    await expect(other.page.getByRole("status").filter({ hasText: /live updates on/i })).toBeAttached({ timeout: 15_000 });

    // Keyboard-only drag: focus card, space to lift, arrow right to next column, space to drop.
    await card(page, "Move me").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(page.getByRole("region", { name: /^In progress column/ }).getByText("Move me")).toBeVisible();

    // Realtime: the other session sees the move without reload (≤ 3 s target; generous timeout for CI).
    await expect(other.page.getByRole("region", { name: /^In progress column/ }).getByText("Move me")).toBeVisible({ timeout: 8_000 });

    await page.reload();
    await expect(page.getByRole("region", { name: /^In progress column/ }).getByText("Move me")).toBeVisible();
    await expectNoSeriousA11yViolations(page, "board");
    await other.context.close();
  });

  test("5 @mention notifies the mentioned user in real time", async ({ page, browser }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Mentioner" });
    await createProject(page, slug, { name: "Mentions", key: "MEN" });
    const url = await createInviteLink(page, slug);
    const other = await joinViaInvite(browser, url, "Mentioned Person");
    // Add the joiner to the project so they can be mentioned.
    await page.goto(`/w/${slug}/p/MEN/settings`);
    await page.getByLabel("Workspace member to add").click();
    await page.getByRole("option", { name: /Mentioned Person/ }).click();
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Remove Mentioned Person" })).toBeVisible();

    await page.goto(`/w/${slug}/p/MEN/board`);
    await quickAdd(page, "To do", "Discuss scope");
    await card(page, "Discuss scope").click();
    await expect(page).toHaveURL(/task=MEN-1/);
    await other.page.goto(`/w/${slug}`);
    await page.goto(`/w/${slug}/members`);
    const row = page.getByRole("list", { name: "Members" }).getByRole("listitem").filter({ hasText: "Mentioned Person" });
    const handle = ((await row.textContent()) ?? "").match(/@([a-z0-9_]{3,20})/)?.[1] ?? "";
    expect(handle).not.toBe("");
    await page.goto(`/w/${slug}/p/MEN/board?task=MEN-1`);
    const box = page.getByRole("combobox", { name: "Comment" });
    await box.fill(`Please review @${handle} `);
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(page.getByText("Please review")).toBeVisible();
    await expect(other.page.getByTestId("unread-badge")).toBeVisible({ timeout: 10_000 });
    await other.page.goto(`/w/${slug}/inbox`);
    await expect(other.page.getByText(/mentioned you on MEN-1/)).toBeVisible();
    await expectNoSeriousA11yViolations(other.page, "inbox");
    await other.context.close();
  });

  test("6 viewers get a read-only board", async ({ page, browser }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Lead Person" });
    await createProject(page, slug, { name: "Viewer Test", key: "VT" });
    await page.goto(`/w/${slug}/p/VT/board`);
    await quickAdd(page, "To do", "Read only task");
    const url = await createInviteLink(page, slug);
    const viewer = await joinViaInvite(browser, url, "View Only");
    await page.goto(`/w/${slug}/p/VT/settings`);
    await page.getByLabel("Workspace member to add").click();
    await page.getByRole("option", { name: /View Only/ }).click();
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByLabel("Role for View Only").click();
    await page.getByRole("option", { name: "Viewer" }).click();
    await expect(page.getByText("Role updated")).toBeVisible();

    await viewer.page.goto(`/w/${slug}/p/VT/board`);
    await expect(viewer.page.getByText("You have view-only access to this project.")).toBeVisible();
    await expect(viewer.page.getByRole("button", { name: "Add task" })).toHaveCount(0);
    await expect(card(viewer.page, "Read only task")).not.toHaveAttribute("aria-roledescription", "draggable task");
    // Database-level enforcement for viewers is covered by pgTAP (phase2_core #55, #57).
    await viewer.context.close();
  });

  test("7–10 filters in URL, ⌘K search by key, bulk edit, CSV export", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Filter Fan" });
    await createProject(page, slug, { name: "Filters", key: "FIL" });
    await page.goto(`/w/${slug}/p/FIL/board`);
    for (const t of ["Alpha task", "Beta task", "Gamma task"]) await quickAdd(page, "To do", t);

    // 9 bulk: set priority of all three to urgent from the List view.
    await page.goto(`/w/${slug}/p/FIL/list?group=none`);
    await page.getByLabel("Select all visible tasks").click();
    await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Priority" }).click();
    await page.getByRole("menuitem", { name: /Urgent/ }).click();
    await expect(page.getByText(/Priority Urgent: 3 tasks/)).toBeVisible();

    // 7 filters via URL.
    await page.goto(`/w/${slug}/p/FIL/board?priority=urgent&q=beta`);
    await expect(card(page, "Beta task")).toBeVisible();
    await expect(card(page, "Alpha task")).toHaveCount(0);

    // 8 ⌘K: typing a key jumps to the task.
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search tasks/).fill("FIL-2");
    await page.getByRole("option", { name: /Open FIL-2/ }).click();
    await page.waitForURL(new RegExp(`/w/${slug}/t/FIL-2$`));
    await expect(page.getByLabel("Task title")).toHaveValue("Beta task");

    // 10 CSV export.
    await page.goto(`/w/${slug}/p/FIL/list`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
    const body = await (await download.createReadStream()).toArray();
    const text = Buffer.concat(body).toString("utf8");
    const lines = text.trim().split(/\r\n/);
    expect(lines[0]).toContain("Key,Title,Status,Priority");
    expect(lines).toHaveLength(4);
  });
});

test.describe("Phase 2 — mobile", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
  test.use({ viewport: { width: 360, height: 740 } });

  test("11 mobile board: Move to… works and pages don't overflow", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Mobile User" });
    await createProject(page, slug, { name: "Mobile", key: "MOB" });
    await page.goto(`/w/${slug}/p/MOB/board`);
    await quickAdd(page, "To do", "Phone task");
    await page.getByRole("button", { name: "Move MOB-1 to…" }).click();
    await page.getByRole("menuitem", { name: /In review/ }).click();
    await expect(page.getByRole("region", { name: /^In review column/ }).getByText("Phone task")).toBeAttached();
    for (const p of [`/w/${slug}/projects`, `/w/${slug}/p/MOB/board`, `/w/${slug}/p/MOB/list`, `/w/${slug}/p/MOB/calendar`, `/w/${slug}/members`, `/w/${slug}/inbox`, `/w/${slug}/my-tasks`]) {
      await page.goto(p);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("12 axe on projects, calendar, members, task page", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Axe Person" });
    await createProject(page, slug, { name: "Axe", key: "AXE" });
    await page.goto(`/w/${slug}/p/AXE/board`);
    await quickAdd(page, "To do", "Accessible task");
    for (const p of [`/w/${slug}/projects`, `/w/${slug}/p/AXE/calendar`, `/w/${slug}/members`, `/w/${slug}/t/AXE-1`]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousA11yViolations(page, p);
    }
  });
});
