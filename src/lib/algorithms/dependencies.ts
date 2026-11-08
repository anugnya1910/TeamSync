/** Dependency helpers — spec §G.6 client mirror + longest open chain (§B.20). */
import { effort, isOpen } from "./common";
import type { DepLite, TaskLite } from "./types";

/** True when adding blocker → blocked would create a cycle (iterative DFS over blocker→blocked). */
export function wouldCreateCycle(edges: DepLite[], blocker: string, blocked: string): boolean {
  if (blocker === blocked) return true;
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.blockerId, [...(out.get(e.blockerId) ?? []), e.blockedId]);
  // A cycle exists if `blocker` is already reachable from `blocked`.
  const stack = [blocked];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === blocker) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const next of out.get(n) ?? []) stack.push(next);
  }
  return false;
}

/** Path from `from` to `to` following existing edges (for friendly cycle messages), or null. */
export function findPath(edges: DepLite[], from: string, to: string): string[] | null {
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.blockerId, [...(out.get(e.blockerId) ?? []), e.blockedId]);
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift()!;
    if (n === to) {
      const path: string[] = [];
      for (let c: string | null = to; c !== null; c = prev.get(c) ?? null) path.unshift(c);
      return path;
    }
    for (const nx of out.get(n) ?? []) {
      if (!prev.has(nx)) {
        prev.set(nx, n);
        queue.push(nx);
      }
    }
  }
  return null;
}

export type Chain = { taskIds: string[]; remainingEffort: number; length: number };

/** Longest chain of OPEN tasks by remaining effort (DAG, memoised DFS). */
export function longestOpenChain(tasks: TaskLite[], deps: DepLite[]): Chain {
  const open = new Map(tasks.filter(isOpen).map((t) => [t.id, t]));
  const out = new Map<string, string[]>();
  for (const d of deps) {
    if (open.has(d.blockerId) && open.has(d.blockedId)) out.set(d.blockerId, [...(out.get(d.blockerId) ?? []), d.blockedId]);
  }
  const memo = new Map<string, { effort: number; path: string[] }>();
  const visiting = new Set<string>();
  const best = (id: string): { effort: number; path: string[] } => {
    const m = memo.get(id);
    if (m) return m;
    if (visiting.has(id)) return { effort: 0, path: [] }; // defensive: cycles are prevented in DB
    visiting.add(id);
    let tail = { effort: 0, path: [] as string[] };
    for (const nx of out.get(id) ?? []) {
      const c = best(nx);
      if (c.effort > tail.effort || (c.effort === tail.effort && c.path.length > tail.path.length)) tail = c;
    }
    visiting.delete(id);
    const res = { effort: effort(open.get(id)!) + tail.effort, path: [id, ...tail.path] };
    memo.set(id, res);
    return res;
  };
  let top = { effort: 0, path: [] as string[] };
  for (const id of open.keys()) {
    const c = best(id);
    if (c.effort > top.effort || (c.effort === top.effort && c.path.length > top.path.length)) top = c;
  }
  return { taskIds: top.path, remainingEffort: top.effort, length: top.path.length };
}
