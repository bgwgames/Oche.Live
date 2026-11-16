import type { Dart, GameId } from './types';

export const GAMES: Record<GameId, { name: string; blurb: string }> = {
  x01: { name: 'X01', blurb: 'Count down from 501. Finish on a double.' },
  cricket: { name: 'Cricket', blurb: 'Close 15 to 20 and the bull. Score on numbers you own.' },
  atc: { name: 'Around the Clock', blurb: 'Hit 1 through 20 in order, then the bull.' },
  shanghai: { name: 'Shanghai', blurb: 'Aim at the round number. A single, double and treble in one turn wins outright.' },
  countup: { name: 'Count-Up', blurb: 'Most points after a set number of rounds.' },
  killer: { name: 'Killer', blurb: 'Hit your own double to become a killer, then knock out everyone else.' },
};

/** Cricket numbers, in board order. 25 is the bull. */
export const CR = [20, 19, 18, 17, 16, 15, 25];

/** Totals from 1 to 180 that three darts cannot score. */
export const IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

/** Board numbers, highest first. */
export const NUMS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/** A dart's score. */
export const dv = (d: Dart): number => (!d.n ? 0 : d.n === 25 ? (d.m === 2 ? 50 : 25) : d.n * d.m);

/** A dart as text: "Miss", "25", "Bull", "T20", "D16", "7". */
export const dl = (d: Dart): string =>
  !d.n ? 'Miss' : d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n;

/** Killer: deal `n` distinct random board numbers. */
export function pickNums(n: number, rand: () => number = Math.random): number[] {
  const a = NUMS.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
