/** Turns a workspace name into a URL slug matching `^[a-z0-9-]{3,40}$` where possible. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base;
}

/** Deterministic alternative suggestion for a taken slug, e.g. `team` → `team-2`. */
export function suggestSlug(slug: string, attempt = 2): string {
  const suffix = `-${attempt}`;
  const trimmed = slug.slice(0, 40 - suffix.length).replace(/-+$/g, "");
  const candidate = `${trimmed}${suffix}`;
  return candidate.length >= 3 ? candidate : `${candidate}-ws`.slice(0, 40);
}
