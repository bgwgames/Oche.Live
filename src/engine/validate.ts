import { IMPOSSIBLE } from './darts';
import type { Dart, Turn } from './types';

const isInt = (x: unknown): x is number => Number.isInteger(x);

/**
 * Checks a turn that came from another phone (untrusted) and returns a clean copy, or null if it's
 * malformed: unknown fields are dropped, darts must be real board segments, totals must be scorable.
 */
export function cleanTurn(s: unknown): Turn | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length > 40 || !Number.isInteger(o.p)) return null;
  const p = o.p as number;
  if (Array.isArray(o.d)) {
    if (o.d.length > 3) return null;
    const d: Dart[] = [];
    for (const x of o.d as unknown[]) {
      const n = (x as Partial<Dart> | null)?.n;
      const m = (x as Partial<Dart> | null)?.m;
      if (!(isInt(n) && ((n >= 0 && n <= 20) || n === 25))) return null;
      if (!(isInt(m) && m >= 1 && m <= (n === 25 ? 2 : 3))) return null;
      d.push({ n, m: n ? m : 1 });
    }
    return { id: o.id, p, d };
  }
  const total = o.total;
  if (typeof total === 'number' && Number.isInteger(total) && total >= 0 && total <= 180 && !IMPOSSIBLE.has(total)) {
    return { id: o.id, p, total };
  }
  return null;
}
