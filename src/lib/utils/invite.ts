/** Extracts an invite token from a pasted URL (…/invite/<token>) or a bare token. */
export function parseInviteToken(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const m = v.match(/\/invite\/([A-Za-z0-9_-]{16,128})(?:[/?#]|$)/);
  if (m) return m[1]!;
  return /^[A-Za-z0-9_-]{16,128}$/.test(v) ? v : null;
}
