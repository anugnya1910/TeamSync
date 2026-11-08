import { expect, test, type Page } from "@playwright/test";
import { AI_MOCK_BASE_URL } from "../../playwright.config";
import { expectNoHorizontalOverflow, expectNoSeriousA11yViolations, hasSupabase, signUpAndOnboard } from "./helpers";
import { card, createInviteLink, createProject, joinViaInvite, quickAdd } from "./phase2-helpers";

/** Sets a task's status from the List view row (no drag needed). */
async function setStatusInList(page: Page, title: string, status: string) {
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: title, exact: true }) });
  await row.getByLabel("Status").click();
  await page.getByRole("option", { name: status, exact: true }).click();
}

async function openTaskFromBoard(page: Page, title: string) {
  await card(page, title).click();
  await expect(page.getByRole("textbox", { name: "Task title", exact: true })).toHaveValue(title);
}

test.describe("Phase 3 — intelligence (desktop)", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
  test.skip(({ isMobile }) => isMobile, "desktop journeys; mobile covered below");

  test("1 dependency, cycle refused, map + blocked badge", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Dep Lead" });
    await createProject(page, slug, { name: "Deps", key: "DEP" });
    await page.goto(`/w/${slug}/p/DEP/board`);
    await quickAdd(page, "To do", "First step");
    await quickAdd(page, "To do", "Second step");

    await openTaskFromBoard(page, "Second step");
    await page.getByRole("button", { name: "Add a task that blocks this one" }).click();
    await page.getByPlaceholder("Search tasks in this project…").fill("First");
    await page.getByRole("option", { name: /DEP-1/ }).click();
    const deps = page.getByRole("region", { name: "Blocked by" });
    await expect(deps.getByRole("button", { name: /DEP-1 First step/ })).toBeVisible();

    // Reverse edge → friendly loop message, nothing saved.
    await page.goto(`/w/${slug}/p/DEP/board?task=DEP-1`);
    await page.getByRole("button", { name: "Add a task that blocks this one" }).click();
    await page.getByPlaceholder("Search tasks in this project…").fill("Second");
    await page.getByRole("option", { name: /DEP-2/ }).click();
    await expect(page.getByText(/This would create a loop: DEP-1 → DEP-2 → DEP-1/)).toBeVisible();

    await page.goto(`/w/${slug}/p/DEP/board`);
    await expect(card(page, "Second step").getByText(/Blocked/).first()).toBeVisible();

    await page.goto(`/w/${slug}/p/DEP/dependencies`);
    await expect(page.getByTestId("dependency-canvas").getByText("DEP-1")).toBeVisible();
    await page.getByRole("button", { name: "List", exact: true }).click();
    const tree = page.getByRole("list", { name: /Dependency tree/ });
    await expect(tree.getByRole("button", { name: /DEP-1/ })).toBeVisible();
    await expect(tree.getByRole("button", { name: /DEP-2/ })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "dependencies (list)");
  });

  test("2 Pulse shows a real score once there are 3 tasks", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Pulse Lead" });
    await createProject(page, slug, { name: "Pulse", key: "PUL" });
    await expect(page.getByRole("img", { name: "Project Pulse: Not enough data" }).first()).toBeVisible();
    await page.goto(`/w/${slug}/p/PUL/board`);
    for (const t of ["One", "Two", "Three"]) await quickAdd(page, "To do", t);
    await page.goto(`/w/${slug}/p/PUL`);
    await expect(page.getByRole("img", { name: /^Project Pulse \d+ out of 100/ }).first()).toBeVisible();
  });

  test("3 workload suggestion → apply → receiver notified", async ({ page, browser }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Busy Lead" });
    await createProject(page, slug, { name: "Balance", key: "BAL" });
    const url = await createInviteLink(page, slug);
    const other = await joinViaInvite(browser, url, "Free Helper");
    await page.goto(`/w/${slug}/p/BAL/settings`);
    await page.getByLabel("Workspace member to add").click();
    await page.getByRole("option", { name: /Free Helper/ }).click();
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Remove Free Helper" })).toBeVisible();

    await page.goto(`/w/${slug}/p/BAL/board`);
    for (const t of ["Load A", "Load B", "Load C"]) await quickAdd(page, "To do", t);
    await page.goto(`/w/${slug}/p/BAL/list?group=none`);
    await page.getByLabel("Select all visible tasks").click();
    await page.getByRole("toolbar", { name: "Bulk actions" }).getByRole("button", { name: "Assignee" }).click();
    await page.getByRole("menuitem", { name: "Busy Lead" }).first().click();
    await expect(page.getByText(/Assigned Busy Lead/)).toBeVisible();

    // 3 tasks × 1 pt × 0.75 (no priority) = 2.25 load against capacity 1 → overloaded; the helper has room.
    await page.goto(`/w/${slug}/p/BAL/workload`);
    const leadRow = page.getByRole("region", { name: "Utilisation this week" }).getByRole("listitem").filter({ hasText: "Busy Lead" });
    await leadRow.getByLabel("Weekly capacity in points").fill("1");
    await leadRow.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Capacity updated")).toBeVisible();
    await expect(page.getByRole("meter", { name: /Busy Lead: 225% of capacity, overloaded/ })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "workload");

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByText(/suggestions? ready/)).toBeVisible();
    await page.getByRole("button", { name: /^Apply: move BAL-\d+ to Free Helper/ }).first().click();
    await expect(page.getByText("Task reassigned")).toBeVisible();

    await other.page.goto(`/w/${slug}/inbox`);
    await expect(other.page.getByText(/Workload rebalanced: you now own BAL-\d+/)).toBeVisible();
    await other.context.close();
  });

  test("4 completing a task earns XP, unlocks First Blood and ranks on the leaderboard", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Xp Earner" });
    await createProject(page, slug, { name: "Xp", key: "XP" });
    const chip = page.getByRole("complementary", { name: "Sidebar" }).getByRole("link", { name: /Level \d+/ });
    await expect(chip).toContainText("50 XP to next");
    await page.goto(`/w/${slug}/p/XP/board`);
    await quickAdd(page, "To do", "Finish me");
    await page.goto(`/w/${slug}/p/XP/list?group=none`);
    await setStatusInList(page, "Finish me", "Done");
    await expect(page.getByText("Achievement unlocked: First Blood").first()).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(chip).not.toContainText("50 XP to next");

    await page.goto(`/w/${slug}/leaderboard`);
    await expect(page.getByRole("region", { name: "Top three" }).getByText("Xp Earner")).toBeVisible();
    await expectNoSeriousA11yViolations(page, "leaderboard");
    await page.goto("/settings/profile");
    await expect(page.getByRole("region", { name: "Achievements" }).getByText(/Unlocked/).first()).toBeVisible();
  });

  test("5 analytics: empty states, then charts with table view", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Chart Fan" });
    await createProject(page, slug, { name: "Charts", key: "CHA" });
    await page.goto(`/w/${slug}/p/CHA/analytics`);
    await expect(page.getByText("No tasks yet — add at least 1 task to see this chart.").first()).toBeVisible();

    await page.goto(`/w/${slug}/p/CHA/board`);
    for (const t of ["Plot A", "Plot B"]) await quickAdd(page, "To do", t);
    await page.goto(`/w/${slug}/p/CHA/list?group=none`);
    await setStatusInList(page, "Plot A", "Done");
    await expect(page.getByRole("row").filter({ hasText: "Plot A" }).getByLabel("Status")).toContainText("Done");

    await page.goto(`/w/${slug}/p/CHA/analytics`);
    for (const title of ["Burndown", "Throughput", "Workload distribution", "Member contributions", "Pulse trend", "Risks by type", "Overdue by priority", "Cumulative flow", "Cycle time"]) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    const burndown = page.getByRole("region", { name: "Burndown" });
    await expect(burndown.getByRole("figure", { name: /Burndown chart/ })).toBeVisible();
    await burndown.getByRole("button", { name: "View as table" }).click();
    await expect(burndown.getByRole("table")).toBeVisible();
    await expect(page.getByRole("region", { name: "Throughput" }).getByRole("figure")).toBeVisible();
    await expectNoSeriousA11yViolations(page, "analytics");

    await page.goto(`/w/${slug}/analytics`);
    await expect(page.getByRole("region", { name: "Project health" }).getByRole("link", { name: "Charts" })).toBeVisible();
  });

  test("6 AI breakdown without a key → rules-based preview → apply creates subtasks", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "No Key" });
    await createProject(page, slug, { name: "Fallback", key: "FB" });
    await page.goto(`/w/${slug}/p/FB/board`);
    await quickAdd(page, "To do", "Write the project report");
    await openTaskFromBoard(page, "Write the project report");
    await page.getByRole("button", { name: "Break down with AI" }).click();
    const dialog = page.getByRole("dialog", { name: "Suggested subtasks" });
    await expect(dialog.getByText("Rules-based")).toBeVisible();
    await expect(dialog.getByText(/AI isn't configured on this server/)).toBeVisible();
    await expect(dialog.getByLabel("Subtask 1 title")).toHaveValue("Outline the structure");
    await dialog.getByRole("button", { name: /^Create \d+ subtasks?$/ }).click();
    await expect(page.getByText(/Created \d+ subtasks/)).toBeVisible();
  });
});

test.describe("Phase 3 — AI with a mocked provider @ai-mock", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
  test.skip(({ isMobile }) => isMobile, "desktop journeys");
  test.use({ baseURL: AI_MOCK_BASE_URL });

  test("7 breakdown is AI-labelled when the provider answers", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Mock Ai" });
    await createProject(page, slug, { name: "Mocked", key: "MOK" });
    await page.goto(`/w/${slug}/p/MOK/board`);
    await quickAdd(page, "To do", "Plan the launch");
    await openTaskFromBoard(page, "Plan the launch");
    await page.getByRole("button", { name: "Break down with AI" }).click();
    const dialog = page.getByRole("dialog", { name: "Suggested subtasks" });
    await expect(dialog.getByText("AI", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Subtask 1 title")).toHaveValue("Mock AI: draft outline");
    await expect(dialog.getByText(/of 20 AI requests left today/)).toBeVisible();
  });

  test("8 workspace limit reached → rules-based summary with the reason", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Limit Admin" });
    await createProject(page, slug, { name: "Limited", key: "LIM" });
    await page.goto(`/w/${slug}/settings`);
    await page.getByLabel("AI requests per day for the workspace").fill("0");
    await page.getByRole("button", { name: "Save" }).nth(1).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await page.goto(`/w/${slug}/p/LIM`);
    const summary = page.getByRole("region", { name: "Summary" });
    await summary.getByRole("button", { name: "Generate" }).click();
    await expect(summary.getByText("Rules-based")).toBeVisible();
    await expect(summary.getByText(/This workspace reached today's AI limit/)).toBeVisible();
  });
});

test.describe("Phase 3 — mobile", () => {
  test.skip(!hasSupabase, "requires a local Supabase stack (E2E_SUPABASE=1)");
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("10 dependency tree list and stacked analytics without overflow", async ({ page }) => {
    const { slug } = await signUpAndOnboard(page, { name: "Phone User" });
    await createProject(page, slug, { name: "Pocket", key: "POC" });
    await page.goto(`/w/${slug}/p/POC/dependencies`);
    await expect(page.getByText("No dependencies")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/w/${slug}/p/POC/analytics`);
    await expect(page.getByRole("heading", { name: "Burndown", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/w/${slug}/p/POC/workload`);
    await expect(page.getByRole("heading", { name: "Utilisation this week" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
