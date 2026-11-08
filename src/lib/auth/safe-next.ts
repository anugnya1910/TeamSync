/**
 * Open-redirect guard: returns `next` only when it is a same-origin relative path, else `fallback`.
 * Rejects absolute URLs, protocol-relative (`//evil.com`), backslash tricks (`/\evil.com`),
 * control characters and auth pages (to avoid redirect loops).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (typeof next !== "string") return fallback;
  let value = next.trim();
  if (!value) return fallback;

  try {
    // Decode once so encoded tricks like %2F%2Fevil.com are caught.
    const decoded = decodeURIComponent(value);
    if (decoded !== value && /^[/\\]{2}|^[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback;
  } catch {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;

  // Resolve against a dummy origin and make sure we stayed on it.
  try {
    const url = new URL(value, "http://teamsync.local");
    if (url.origin !== "http://teamsync.local") return fallback;
    value = url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }

  if (/^\/(login|signup)(\/|\?|#|$)/.test(value)) return fallback;
  return value;
}
