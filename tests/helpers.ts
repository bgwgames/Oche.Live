import type { Dart, DartsTurn, TotalTurn } from '../src/engine';

let seq = 0;
/** A dart: D(20) single 20, D(20, 3) treble 20, D(25, 2) bull, D(0) miss. */
export const D = (n: number, m = 1): Dart => ({ n, m });
/** A dart-by-dart turn for player `p`. */
export const T = (p: number, ...d: Dart[]): DartsTurn => ({ id: 't' + seq++, p, d });
/** A turn-total turn for player `p`. */
export const Tot = (p: number, total: number): TotalTurn => ({ id: 't' + seq++, p, total });
export const T180 = (p: number): DartsTurn => T(p, D(20, 3), D(20, 3), D(20, 3));
export const MISS = (p: number): DartsTurn => T(p, D(0), D(0), D(0));
