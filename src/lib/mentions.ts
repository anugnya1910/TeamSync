/** Client mirror of `extract_mention_handles` (p2_collaboration). */
const MENTION_RE = /(?<![a-z0-9_@])@([a-z0-9_]{3,20})/g;

export function extractMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.toLowerCase().matchAll(MENTION_RE)) out.add(m[1]!);
  return [...out];
}

/**
 * If the caret is right after an `@partial` token, returns the partial handle and where it
 * starts (for the autocomplete popover); otherwise null.
 */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(?:^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{0,20})$/);
  if (!m) return null;
  return { query: m[1]!.toLowerCase(), start: caret - m[1]!.length - 1 };
}

/** Replaces the active `@partial` with `@handle ` and returns the new text + caret. */
export function insertMention(text: string, start: number, caret: number, handle: string) {
  const insert = `@${handle} `;
  return { text: text.slice(0, start) + insert + text.slice(caret), caret: start + insert.length };
}
