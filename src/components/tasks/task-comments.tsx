"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, MoreHorizontal } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addComment, deleteComment, editComment } from "@/app/(app)/w/[workspaceSlug]/_actions/task";
import { EmptyState } from "@/components/brand/empty-state";
import { Markdown } from "@/components/common/markdown";
import { UserAvatar } from "@/components/common/visuals";
import { useWorkspace } from "@/components/layout/workspace-context";
import { useProject } from "@/components/project/project-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { activeMentionQuery, insertMention } from "@/lib/mentions";
import { qk } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type CommentRow = { id: string; body: string; author_id: string | null; created_at: string; edited_at: string | null };

function useComments(taskId: string) {
  return useQuery({
    queryKey: qk.taskComments(taskId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("comments")
        .select("id, body, author_id, created_at, edited_at")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
  });
}

/** Markdown composer with @mention autocomplete (project members), ⌘/Ctrl+Enter to send. */
export function CommentComposer({
  onSubmit,
  initial = "",
  submitLabel = "Comment",
  onCancel,
  autoFocus,
}: {
  onSubmit: (body: string) => Promise<boolean>;
  initial?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const { members } = useProject();
  const [body, setBody] = useState(initial);
  const [pending, start] = useTransition();
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    return members
      .filter((m) => m.profile.handle.startsWith(mention.query) || m.profile.full_name.toLowerCase().includes(mention.query))
      .slice(0, 6);
  }, [mention, members]);

  const choose = (handle: string) => {
    const el = ref.current;
    if (!el || !mention) return;
    const next = insertMention(body, mention.start, el.selectionStart, handle);
    setBody(next.text);
    setMention(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      if (await onSubmit(text)) setBody("");
    });
  };

  const listId = "mention-listbox";
  return (
    <Tabs defaultValue="write" className="gap-2">
      <TabsList className="h-8">
        <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
        <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="write" className="relative">
        <Textarea
          ref={ref}
          value={body}
          autoFocus={autoFocus}
          aria-label="Comment"
          placeholder="Write a comment… use @ to mention a teammate"
          maxLength={10000}
          className="min-h-20"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setBody(e.target.value);
            setMention(activeMentionQuery(e.target.value, e.target.selectionStart));
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                choose(suggestions[highlight]!.profile.handle);
                return;
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {suggestions.length ? (
          <ul id={listId} role="listbox" className="absolute top-full left-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-popover shadow-[var(--shadow-e2)]">
            {suggestions.map((m, i) => (
              <li
                key={m.user_id}
                role="option"
                aria-selected={i === highlight}
                className={cn("flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm", i === highlight && "bg-muted")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m.profile.handle);
                }}
              >
                <UserAvatar name={m.profile.full_name} url={m.profile.avatar_url} className="size-5" />
                <span className="truncate">{m.profile.full_name}</span>
                <span className="ml-auto text-xs text-muted-foreground">@{m.profile.handle}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </TabsContent>
      <TabsContent value="preview" className="min-h-20 rounded-lg border p-3">
        {body.trim() ? <Markdown mentionHandles={members.map((m) => m.profile.handle)}>{body}</Markdown> : <p className="text-sm text-muted-foreground">Nothing to preview.</p>}
      </TabsContent>
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">Markdown supported · ⌘/Ctrl + Enter to send</span>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? "Sending…" : submitLabel}
        </Button>
      </div>
    </Tabs>
  );
}

export function TaskComments({ taskId }: { taskId: string }) {
  const { data: comments, isPending } = useComments(taskId);
  const { members, memberById, permissions } = useProject();
  const { user } = useWorkspace();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const handles = members.map((m) => m.profile.handle);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.taskComments(taskId) });
    void qc.invalidateQueries({ queryKey: qk.taskActivity(taskId) });
  };

  return (
    <div className="space-y-4">
      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments?.length ? (
        <ol className="space-y-4" aria-label="Comments">
          {comments.map((c) => {
            const author = c.author_id ? memberById.get(c.author_id)?.profile : undefined;
            const name = author?.full_name ?? "Former member";
            const mine = c.author_id === user.id;
            return (
              <li key={c.id} className="flex gap-2.5">
                <UserAvatar name={name} url={author?.avatar_url} className="size-7" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground">{name}</span>
                    <time className="text-muted-foreground" dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </time>
                    {c.edited_at ? <span className="text-muted-foreground">· edited</span> : null}
                    {mine || permissions.canEditProject ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Comment actions">
                            <MoreHorizontal className="size-3.5" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {mine ? <DropdownMenuItem onSelect={() => setEditing(c.id)}>Edit</DropdownMenuItem> : null}
                          <DropdownMenuItem
                            onSelect={async () => {
                              if (!window.confirm("Delete this comment?")) return;
                              const res = await deleteComment(c.id);
                              if (res.ok) refresh();
                              else toast.error(res.error.message);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  {editing === c.id ? (
                    <div className="mt-1.5">
                      <CommentComposer
                        initial={c.body}
                        submitLabel="Save"
                        autoFocus
                        onCancel={() => setEditing(null)}
                        onSubmit={async (body) => {
                          const res = await editComment({ commentId: c.id, body });
                          if (!res.ok) {
                            toast.error(res.error.message);
                            return false;
                          }
                          setEditing(null);
                          refresh();
                          return true;
                        }}
                      />
                    </div>
                  ) : (
                    <Markdown className="mt-0.5" mentionHandles={handles}>
                      {c.body}
                    </Markdown>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Start the discussion — mention teammates with @." compact as="h3" />
      )}
      {permissions.canComment ? (
        <CommentComposer
          onSubmit={async (body) => {
            const res = await addComment({ taskId, body });
            if (!res.ok) {
              toast.error(res.error.message);
              return false;
            }
            refresh();
            return true;
          }}
        />
      ) : null}
    </div>
  );
}
