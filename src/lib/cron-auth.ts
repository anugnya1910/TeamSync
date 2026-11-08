import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time check of `Authorization: Bearer <secret>`. False when no secret is configured. */
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length) {
    // still spend comparable time
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(given, expected);
}
