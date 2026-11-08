/**
 * RFC 4180 CSV with spreadsheet formula-injection protection (spec §E.2, §H.1):
 * cells starting with = + - @ TAB or CR are prefixed with a single quote.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",") + "\r\n";
}
