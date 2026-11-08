/** Parses a task key like "TS-42" (case-insensitive) into project key + number. */
export function parseTaskKey(input: string): { projectKey: string; number: number } | null {
  const m = input.trim().match(/^([A-Za-z]{2,5})-(\d{1,9})$/);
  if (!m) return null;
  const number = Number(m[2]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return { projectKey: m[1]!.toUpperCase(), number };
}

export function formatTaskKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** Suggests a 2–5 letter project key from a name: initials, else the first letters. */
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[^A-Za-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  let key = words.length >= 2 ? words.map((w) => w[0]).join("") : words[0]!.slice(0, 3);
  if (key.length < 2) key = (words[0]! + "XX").slice(0, 2);
  return key.toUpperCase().slice(0, 5);
}
