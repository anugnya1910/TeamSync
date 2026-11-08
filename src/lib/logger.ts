/**
 * Minimal structured logger (Appendix 1: no bare console.log in committed code).
 * Server logs end up in Vercel/Supabase logs; nothing sensitive should be passed in `meta`.
 */
type Meta = Record<string, unknown>;

function fmt(level: string, msg: string, meta?: Meta) {
  return meta ? `[teamsync:${level}] ${msg} ${safeJson(meta)}` : `[teamsync:${level}] ${msg}`;
}

function safeJson(meta: Meta) {
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserialisable meta]";
  }
}

export const logger = {
  info(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV !== "test") console.info(fmt("info", msg, meta));
  },
  warn(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV !== "test") console.warn(fmt("warn", msg, meta));
  },
  error(msg: string, meta?: Meta) {
    if (process.env.NODE_ENV !== "test") console.error(fmt("error", msg, meta));
  },
};
