import { describe, expect, it } from "vitest";
import { boldSegments, describeActivity } from "@/lib/activity";
import { mapPgError } from "@/lib/action-result";
import { activeFilterCount, dueBucket, EMPTY_FILTERS, matchesFilters, parseFilters, serializeFilters, type FilterableTask } from "@/lib/filters";
import { activeMentionQuery, extractMentions, insertMention } from "@/lib/mentions";
import { canDeleteTask, derivePermissions } from "@/lib/permissions";
import { escapeCsvCell, toCsvRow } from "@/lib/utils/csv";
import { needsRenormalise, neighboursForIndex, positionBetween } from "@/lib/utils/fractional-index";
import { parseQuickDate } from "@/lib/utils/quick-date";
import { parseTaskKey, suggestProjectKey } from "@/lib/utils/task-key";

// Sunday 8 November 2026
const today = new Date(2026, 10, 8);

describe("parseQuickDate", () => {
  it.each([
    ["today", "2026-11-08"],
    ["Tomorrow", "2026-11-09"],
    ["tmr", "2026-11-09"],
    ["yesterday", "2026-11-07"],
    ["+3d", "2026-11-11"],
    ["in 2 days", "2026-11-10"],
    ["+2w", "2026-11-22"],
    ["fri", "2026-11-13"],
    ["friday", "2026-11-13"],
    ["sun", "2026-11-15"],
    ["next mon", "2026-11-16"],
    ["next week", "2026-11-09"],
    ["2026-12-25", "2026-12-25"],
  ])("%s → %s", (input, expected) => {
    expect(parseQuickDate(input, today, 1)).toBe(expected);
  });
  it("next week honours a Sunday week start", () => {
    expect(parseQuickDate("next week", today, 0)).toBe("2026-11-15");
  });
  it.each(["", "someday", "2026-02-30", "+d", "13/12/2026"])("rejects %j", (input) => {
    expect(parseQuickDate(input, today)).toBeNull();
  });
});

describe("fractional positions", () => {
  it("places between, before and after", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(1024, null)).toBe(2048);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween(null, null)).toBe(1024);
  });
  it("detects when renormalisation is needed", () => {
    expect(needsRenormalise(1, 1 + 1e-12)).toBe(true);
    expect(needsRenormalise(1, 2)).toBe(false);
    expect(needsRenormalise(null, 2)).toBe(false);
  });
  it("computes neighbours ignoring the moving card", () => {
    const col = [
      { id: "a", position: 1024 },
      { id: "b", position: 2048 },
      { id: "c", position: 3072 },
    ];
    expect(neighboursForIndex(col, "c", 0)).toEqual({ before: null, after: 1024 });
    expect(neighboursForIndex(col, "a", 1)).toEqual({ before: 2048, after: 3072 });
    expect(neighboursForIndex(col, "x", 99)).toEqual({ before: 3072, after: null });
  });
});

describe("CSV", () => {
  it("quotes per RFC 4180", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(["x", "y"])).toBe("x; y");
  });
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"])("neutralises formula %j", (v) => {
    expect(escapeCsvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("builds rows with CRLF", () => {
    expect(toCsvRow(["TS-1", "Title", 3])).toBe("TS-1,Title,3\r\n");
  });
});

describe("task keys", () => {
  it("parses keys", () => {
    expect(parseTaskKey("ts-42")).toEqual({ projectKey: "TS", number: 42 });
    expect(parseTaskKey("CAP-7 ")).toEqual({ projectKey: "CAP", number: 7 });
    expect(parseTaskKey("TOOLONG-1")).toBeNull();
    expect(parseTaskKey("TS-0")).toBeNull();
    expect(parseTaskKey("TS42")).toBeNull();
  });
  it("suggests project keys", () => {
    expect(suggestProjectKey("Team Sync")).toBe("TS");
    expect(suggestProjectKey("College Final Year Project")).toBe("CFYP");
    expect(suggestProjectKey("Capstone")).toBe("CAP");
    expect(suggestProjectKey("A")).toBe("AX");
    expect(suggestProjectKey("123")).toBe("");
  });
});

describe("mentions", () => {
  it("extracts handles like the database trigger", () => {
    expect(extractMentions("Hi @ananya_01 and @Rahul! cc @ab @x email@test.com")).toEqual(["ananya_01", "rahul"]);
    expect(extractMentions("@@double and @valid_one")).toEqual(["valid_one"]);
  });
  it("detects the active autocomplete query", () => {
    expect(activeMentionQuery("Hello @ana", 10)).toEqual({ query: "ana", start: 6 });
    expect(activeMentionQuery("@", 1)).toEqual({ query: "", start: 0 });
    expect(activeMentionQuery("email@test", 10)).toBeNull();
    expect(activeMentionQuery("Hello ana", 9)).toBeNull();
  });
  it("inserts the chosen handle", () => {
    expect(insertMention("Hi @an there", 3, 6, "ananya")).toEqual({ text: "Hi @ananya  there", caret: 11 });
  });
});

describe("permissions", () => {
  it("workspace admins act as lead", () => {
    const p = derivePermissions({ workspaceRole: "admin", projectRole: null, isProjectContext: true });
    expect(p.projectRole).toBe("lead");
    expect(p.canEditProject && p.canEditTasks && p.canOverrideBlocked).toBe(true);
  });
  it("contributors edit tasks but not the project", () => {
    const p = derivePermissions({ workspaceRole: "member", projectRole: "contributor", isProjectContext: true });
    expect(p.canEditTasks).toBe(true);
    expect(p.canEditProject).toBe(false);
    expect(canDeleteTask(p, "me", "me")).toBe(true);
    expect(canDeleteTask(p, "other", "me")).toBe(false);
  });
  it("viewers and non-members are read-only with a reason", () => {
    const v = derivePermissions({ workspaceRole: "member", projectRole: "viewer", isProjectContext: true });
    expect(v.canEditTasks).toBe(false);
    expect(v.readOnlyReason).toMatch(/view-only/);
    const n = derivePermissions({ workspaceRole: "member", projectRole: null, isProjectContext: true });
    expect(n.canEditTasks).toBe(false);
  });
  it("archived projects are read-only even for leads", () => {
    const p = derivePermissions({ workspaceRole: "owner", projectStatus: "archived", isProjectContext: true });
    expect(p.canEditTasks).toBe(false);
    expect(p.readOnlyReason).toMatch(/archived/);
  });
  it("guests cannot create projects", () => {
    expect(derivePermissions({ workspaceRole: "guest" }).canCreateProjects).toBe(false);
    expect(derivePermissions({ workspaceRole: "member" }).canCreateProjects).toBe(true);
  });
});

describe("filters ↔ URL", () => {
  it("round-trips", () => {
    const f = { ...EMPTY_FILTERS, assignee: ["me"], status: ["todo", "in_progress"] as const, priority: ["urgent"] as const, due: "overdue" as const, blocked: true, q: "login" };
    const params = serializeFilters({ ...f, status: [...f.status], priority: [...f.priority] });
    expect(params.toString()).toContain("assignee=me");
    expect(parseFilters(params)).toEqual({ ...f, status: ["todo", "in_progress"], priority: ["urgent"] });
    expect(activeFilterCount(parseFilters(params))).toBe(7);
  });
  it("drops unknown values and keeps other params", () => {
    const p = parseFilters(new URLSearchParams("status=todo,bogus&priority=wild&due=sometime&view=list"));
    expect(p.status).toEqual(["todo"]);
    expect(p.priority).toEqual([]);
    expect(p.due).toBeNull();
    expect(serializeFilters(EMPTY_FILTERS, new URLSearchParams("view=list")).toString()).toBe("view=list");
  });
  it("accepts Next.js searchParams objects", () => {
    expect(parseFilters({ priority: ["high", "x"], q: "abc" }).priority).toEqual(["high"]);
  });
});

describe("matchesFilters", () => {
  const base: FilterableTask = {
    title: "Build login",
    key: "TS-9",
    status: "in_progress",
    priority: "high",
    due_date: "2026-11-07",
    is_blocked: false,
    milestone_id: null,
    assigneeIds: ["u1"],
    labelIds: ["l1"],
  };
  const ctx = { userId: "u1", today: "2026-11-08" };
  it("assignee me / unassigned", () => {
    expect(matchesFilters(base, { ...EMPTY_FILTERS, assignee: ["me"] }, ctx)).toBe(true);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, assignee: ["unassigned"] }, ctx)).toBe(false);
  });
  it("due buckets", () => {
    expect(matchesFilters(base, { ...EMPTY_FILTERS, due: "overdue" }, ctx)).toBe(true);
    expect(matchesFilters({ ...base, status: "done" }, { ...EMPTY_FILTERS, due: "overdue" }, ctx)).toBe(false);
    expect(matchesFilters({ ...base, due_date: "2026-11-08" }, { ...EMPTY_FILTERS, due: "today" }, ctx)).toBe(true);
    expect(matchesFilters({ ...base, due_date: null }, { ...EMPTY_FILTERS, due: "none" }, ctx)).toBe(true);
    expect(matchesFilters({ ...base, due_date: "2026-11-09" }, { ...EMPTY_FILTERS, due: "week" }, { ...ctx, weekStartsOn: 0 })).toBe(true);
  });
  it("text, labels, milestone, blocked, priority", () => {
    expect(matchesFilters(base, { ...EMPTY_FILTERS, q: "ts-9" }, ctx)).toBe(true);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, q: "nope" }, ctx)).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, label: ["l2"] }, ctx)).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, milestone: ["none"] }, ctx)).toBe(true);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, blocked: true }, ctx)).toBe(false);
    expect(matchesFilters(base, { ...EMPTY_FILTERS, priority: ["urgent", "high"] }, ctx)).toBe(true);
  });
  it("dueBucket", () => {
    expect(dueBucket(null, "2026-11-08")).toBe("none");
    expect(dueBucket("2026-11-01", "2026-11-08")).toBe("overdue");
    expect(dueBucket("2026-11-08", "2026-11-08")).toBe("today");
    expect(dueBucket("2026-11-12", "2026-11-08")).toBe("week");
    expect(dueBucket("2026-12-12", "2026-11-08")).toBe("later");
  });
});

describe("activity sentences", () => {
  const row = (action: string, metadata: Record<string, unknown>) => ({ id: 1, action, actor_id: "a", metadata: metadata as never, created_at: "" });
  it("describes status moves with labels", () => {
    expect(describeActivity(row("task.status_changed", { key: "TS-14", from: "in_progress", to: "in_review" }), "Priya")).toBe(
      "Priya moved **TS-14** from In progress → In review",
    );
  });
  it("describes assignments, comments and membership", () => {
    expect(describeActivity(row("task.assigned", { key: "TS-1", user_name: "Rahul" }), "Ananya")).toBe("Ananya assigned Rahul to **TS-1**");
    expect(describeActivity(row("comment.added", { key: "TS-1" }), "Ananya")).toBe("Ananya commented on **TS-1**");
    expect(describeActivity(row("member.joined", { user_name: "Jay", role: "member" }), "Jay")).toBe("Jay joined the workspace as Member");
    expect(describeActivity(row("unknown.action", {}), "X")).toBe("X made a change");
  });
  it("splits bold segments safely", () => {
    expect(boldSegments("A moved **TS-1** to done")).toEqual([
      { text: "A moved ", bold: false },
      { text: "TS-1", bold: true },
      { text: " to done", bold: false },
    ]);
  });
});

describe("mapPgError (Phase 2 prefixes)", () => {
  it("maps SUBTASKS_OPEN and RATE_LIMITED", () => {
    expect(mapPgError({ code: "P0001", message: "SUBTASKS_OPEN: complete subtasks" }).code).toBe("SUBTASKS_OPEN");
    expect(mapPgError({ code: "P0001", message: "RATE_LIMITED: slow down" }).code).toBe("RATE_LIMITED");
  });
});
