import { NUMS, dv } from './darts';
import type { Dart } from './types';

/** Finishing doubles in order of preference. */
const FIN: Dart[] = [20, 16, 12, 8, 10, 18, 14, 6, 4, 2, 25, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map((n) => ({ n, m: 2 }));
/** Set-up darts: trebles first, then singles, then the bulls. */
const SET: Dart[] = [...NUMS.map((n) => ({ n, m: 3 })), ...NUMS.map((n) => ({ n, m: 1 })), { n: 25, m: 1 }, { n: 25, m: 2 }];
const memo = new Map<string, Dart[] | null>();

/** A double-out route for `score` using at most `left` darts, or null if there isn't one. */
export function checkout(score: number, left: number): Dart[] | null {
  if (score < 2 || score > 170 || left < 1) return null;
  const key = score + ':' + left;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let r: Dart[] | null = null;
  for (const D of FIN) if (dv(D) === score) { r = [D]; break; }
  if (!r && left >= 2) {
    outer2: for (const D of FIN) for (const A of SET) if (dv(A) + dv(D) === score) { r = [A, D]; break outer2; }
  }
  if (!r && left >= 3) {
    outer3: for (const A of SET) for (const D of FIN) {
      const need = score - dv(A) - dv(D);
      if (need < 1) continue;
      for (const B of SET) if (dv(B) === need) { r = [A, B, D]; break outer3; }
    }
  }
  memo.set(key, r);
  return r;
}
