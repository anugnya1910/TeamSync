/** IANA timezone helpers backed by the runtime's Intl data. */
export function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    // Intl may omit UTC in some runtimes.
    return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    return ["UTC", "Asia/Kolkata", "Europe/London", "America/New_York"];
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function detectTimeZone(fallback = "Asia/Kolkata"): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : fallback;
  } catch {
    return fallback;
  }
}
