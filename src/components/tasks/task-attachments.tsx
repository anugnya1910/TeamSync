"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, File, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { clientInsert } from "@/lib/db-insert";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]);

export function sanitizeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return (cleaned || "file").slice(-120);
}

function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Task attachments: private bucket, ≤ 5 MB, MIME allowlist, signed URLs (60 min) — spec §B.13. */
export function TaskAttachments({ taskId, workspaceId }: { taskId: string; workspaceId: string }) {
  const { project, permissions, memberById } = useProject();
  const { user } = useWorkspace();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const key = qk.taskAttachments(taskId);

  const { data: files } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("attachments")
        .select("id, file_name, mime_type, size_bytes, storage_path, uploaded_by, created_at")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setBusy(true);
    const supabase = createClient();
    try {
      for (const f of arr) {
        if (!ALLOWED.has(f.type)) {
          toast.error(`${f.name}: this file type isn't allowed.`);
          continue;
        }
        if (f.size > MAX) {
          toast.error(`${f.name} is larger than 5 MB.`);
          continue;
        }
        const path = `${workspaceId}/${project.id}/${taskId}/${crypto.randomUUID()}-${sanitizeFileName(f.name)}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) {
          toast.error(`Couldn't upload ${f.name}.`);
          continue;
        }
        const { error } = await supabase.from("attachments").insert(
          clientInsert("attachments", { task_id: taskId, storage_path: path, file_name: f.name.slice(0, 200), mime_type: f.type, size_bytes: f.size }),
        );
        if (error) {
          await supabase.storage.from("attachments").remove([path]);
          toast.error(`Couldn't save ${f.name}.`);
        }
      }
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: key });
    }
  }

  async function open(path: string, name: string) {
    const { data, error } = await createClient().storage.from("attachments").createSignedUrl(path, 3600, { download: name });
    if (error || !data) return toast.error("Couldn't create a download link.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(id: string, path: string) {
    if (!window.confirm("Delete this attachment?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("attachments").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete the attachment.");
    await supabase.storage.from("attachments").remove([path]);
    void qc.invalidateQueries({ queryKey: key });
  }

  return (
    <section aria-labelledby="attachments-h" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id="attachments-h" className="text-sm font-semibold">
          Attachments {files?.length ? <span className="text-muted-foreground">({files.length})</span> : null}
        </h3>
        {permissions.canEditTasks ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              aria-label="Upload attachments"
              tabIndex={-1}
              accept={[...ALLOWED].join(",")}
              onChange={(e) => {
                if (e.target.files) void upload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Paperclip className="size-3.5" aria-hidden />}
              Attach
            </Button>
          </>
        ) : null}
      </div>
      {permissions.canEditTasks ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5",
          )}
        >
          Drop files here · images, PDF, text, Office docs, zip · max 5 MB
        </div>
      ) : null}
      {files?.length ? (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(f.size_bytes)}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => void open(f.storage_path, f.file_name)} aria-label={`Download ${f.file_name}`}>
                <Download className="size-3.5" aria-hidden />
              </Button>
              {f.uploaded_by === user.id || permissions.canEditProject ? (
                <Button variant="ghost" size="icon-sm" onClick={() => void remove(f.id, f.storage_path)} aria-label={`Delete ${f.file_name}`}>
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : null}
              <span className="sr-only">uploaded by {memberById.get(f.uploaded_by ?? "")?.profile.full_name ?? "a member"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
