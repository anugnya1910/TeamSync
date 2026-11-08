/** Fractional ordering helpers mirroring the `move_task` RPC (spec §B.9, risk R8). */
export const POSITION_STEP = 1024;
export const MIN_GAP = 1e-9;

/** Position for an item placed between `before` (above) and `after` (below). */
export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  const b = before ?? null;
  const a = after ?? null;
  if (b !== null && a !== null) return (b + a) / 2;
  if (b !== null) return b + POSITION_STEP;
  if (a !== null) return a - POSITION_STEP;
  return POSITION_STEP;
}

/** True when the gap is too small and the server will renormalise the column. */
export function needsRenormalise(before: number | null | undefined, after: number | null | undefined): boolean {
  return before != null && after != null && after - before < MIN_GAP;
}

/**
 * Given a column already sorted by position and the index where `movingId` should land,
 * returns the neighbour positions to send to `move_task`.
 */
export function neighboursForIndex<T extends { id: string; position: number }>(
  column: T[],
  movingId: string,
  targetIndex: number,
): { before: number | null; after: number | null } {
  const others = column.filter((t) => t.id !== movingId);
  const idx = Math.max(0, Math.min(targetIndex, others.length));
  return {
    before: idx > 0 ? others[idx - 1]!.position : null,
    after: idx < others.length ? others[idx]!.position : null,
  };
}
