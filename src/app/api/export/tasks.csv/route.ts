import { formatInTimeZone } from "date-fns-tz";
import { NextResponse, type NextRequest } from "next/server";
import { matchesFilters, parseFilters } from "@/lib/filters";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { toCsvRow } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

const lastExport = new Map<string, number>();

/**
 * CSV export of a project's tasks (spec §B.26, §E.2). Runs under the user's session so RLS
 * applies; respects the same filter params as the List view; formula-injection safe.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Best-effort per-instance throttle: 1 export / 10 s / user (spec §H.1).
  const now = Date.now();
  if (now - (lastExport.get(userId) ?? 0) < 10_000) {
    return NextResponse.json({ error: "Please wait a few seconds before exporting again." }, { status: 429 });
  }
  lastExport.set(userId, now);

  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: "invalid project" }, { status: 400 });

  const supabase = await createClient();
  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id, key, name").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
  ]);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, number, title, status, priority, effort_points, start_date, due_date, is_blocked, milestone_id, created_at, updated_at, completed_at, " +
        "milestone:milestones(name), assignees:task_assignees(user_id, profile:profiles(full_name)), labels:task_labels(label_id, label:labels(name))",
    )
    .eq("project_id", projectId)
    .order("number");
  if (error) return NextResponse.json({ error: "export failed" }, { status: 500 });

  const tz = profile?.timezone ?? "UTC";
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const filters = parseFilters(request.nextUrl.searchParams);

  type Row = {
    number: number; title: string; status: keyof typeof STATUS_LABELS; priority: keyof typeof PRIORITY_LABELS;
    effort_points: number | null; start_date: string | null; due_date: string | null; is_blocked: boolean;
    milestone_id: string | null; created_at: string; updated_at: string; completed_at: string | null;
    milestone: { name: string } | null;
    assignees: { user_id: string; profile: { full_name: string } | null }[];
    labels: { label_id: string; label: { name: string } | null }[];
  };
  const rows = ((tasks ?? []) as unknown as Row[]).filter((t) =>
    matchesFilters(
      {
        title: t.title,
        key: `${project.key}-${t.number}`,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        is_blocked: t.is_blocked,
        milestone_id: t.milestone_id,
        assigneeIds: t.assignees.map((a) => a.user_id),
        labelIds: t.labels.map((l) => l.label_id),
      },
      filters,
      { userId, today },
    ),
  );

  const header = ["Key", "Title", "Status", "Priority", "Effort", "Assignees", "Labels", "Milestone", "Start date", "Due date", "Blocked", "Created", "Updated", "Completed"];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("﻿" + toCsvRow(header)));
      for (const t of rows) {
        controller.enqueue(
          encoder.encode(
            toCsvRow([
              `${project.key}-${t.number}`,
              t.title,
              STATUS_LABELS[t.status],
              PRIORITY_LABELS[t.priority],
              t.effort_points ?? "",
              t.assignees.map((a) => a.profile?.full_name ?? "").filter(Boolean),
              t.labels.map((l) => l.label?.name ?? "").filter(Boolean),
              t.milestone?.name ?? "",
              t.start_date ?? "",
              t.due_date ?? "",
              t.is_blocked ? "yes" : "no",
              t.created_at,
              t.updated_at,
              t.completed_at ?? "",
            ]),
          ),
        );
      }
      controller.close();
    },
  });

  const filename = `${project.key}-tasks-${today}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(rows.length),
    },
  });
}
