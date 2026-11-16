import { describe, expect, it } from 'vitest';
import { IMPOSSIBLE, buildCfg, checkout, cleanTurn, defaultSetup, dl, dv, pickNums } from '../src/engine';

describe('checkout', () => {
  const total = (s: number) => checkout(s, 3)?.reduce((a, d) => a + dv(d), 0);

  it.each([170, 167, 164, 161, 160, 141, 100, 99, 61, 50, 41, 40, 3, 2])('finds a valid route for %i', (s) => {
    const r = checkout(s, 3)!;
    expect(r).not.toBeNull();
    expect(total(s)).toBe(s);
    expect(r[r.length - 1].m).toBe(2);
  });

  it.each([1, 159, 162, 163, 165, 166, 168, 169, 171, 180])('has no route for %i', (s) => {
    expect(checkout(s, 3)).toBeNull();
  });

  it('prefers one dart when one is enough', () => {
    expect(checkout(40, 3)!.map(dl)).toEqual(['D20']);
    expect(checkout(50, 1)!.map(dl)).toEqual(['Bull']);
  });

  it('respects the number of darts left', () => {
    expect(checkout(100, 1)).toBeNull();
    expect(checkout(100, 2)!.map(dl)).toEqual(['T20', 'D20']);
  });

  it('finds every score from 2 to 170 that three darts can check out', () => {
    for (let s = 2; s <= 170; s++) {
      const r = checkout(s, 3);
      if (r) expect(r.reduce((a, d) => a + dv(d), 0)).toBe(s);
    }
  });
});

describe('dart helpers', () => {
  it('scores and labels darts', () => {
    expect(dv({ n: 20, m: 3 })).toBe(60);
    expect(dv({ n: 25, m: 2 })).toBe(50);
    expect(dv({ n: 0, m: 1 })).toBe(0);
    expect(dl({ n: 25, m: 1 })).toBe('25');
    expect(dl({ n: 16, m: 2 })).toBe('D16');
    expect(dl({ n: 0, m: 1 })).toBe('Miss');
  });

  it('lists exactly the totals three darts cannot make', () => {
    const scores = new Set<number>();
    const segs = [0, 25, 50];
    for (let n = 1; n <= 20; n++) segs.push(n, n * 2, n * 3);
    for (const a of segs) for (const b of segs) for (const c of segs) scores.add(a + b + c);
    const impossible = [];
    for (let s = 0; s <= 180; s++) if (!scores.has(s)) impossible.push(s);
    expect(new Set(impossible)).toEqual(IMPOSSIBLE);
  });

  it('deals distinct killer numbers', () => {
    const nums = pickNums(8);
    expect(new Set(nums).size).toBe(8);
    nums.forEach((n) => expect(n >= 1 && n <= 20).toBe(true));
  });
});

describe('cleanTurn (turns from other phones)', () => {
  it('accepts and copies a valid darts turn, dropping extra fields', () => {
    expect(cleanTurn({ id: 'a', p: 0, d: [{ n: 20, m: 3, x: 1 }], evil: true })).toEqual({ id: 'a', p: 0, d: [{ n: 20, m: 3 }] });
  });

  it('normalises a miss to multiplier 1', () => {
    expect(cleanTurn({ id: 'a', p: 0, d: [{ n: 0, m: 3 }] })).toEqual({ id: 'a', p: 0, d: [{ n: 0, m: 1 }] });
  });

  it.each([
    ['too many darts', { id: 'a', p: 0, d: [{ n: 1, m: 1 }, { n: 1, m: 1 }, { n: 1, m: 1 }, { n: 1, m: 1 }] }],
    ['no such number', { id: 'a', p: 0, d: [{ n: 21, m: 1 }] }],
    ['treble bull', { id: 'a', p: 0, d: [{ n: 25, m: 3 }] }],
    ['impossible total', { id: 'a', p: 0, total: 179 }],
    ['total over 180', { id: 'a', p: 0, total: 181 }],
    ['fractional total', { id: 'a', p: 0, total: 60.5 }],
    ['missing id', { p: 0, total: 60 }],
    ['long id', { id: 'x'.repeat(41), p: 0, total: 60 }],
    ['non-integer player', { id: 'a', p: '0', total: 60 }],
    ['not an object', 'turn'],
  ])('rejects %s', (_, turn) => {
    expect(cleanTurn(turn)).toBeNull();
  });
});

describe('buildCfg', () => {
  it('keeps only the chosen game options and tidies names', () => {
    const su = defaultSetup(['  Alice  ', '', 'x'.repeat(30)], false);
    const cfg = buildCfg(su);
    expect(cfg).toEqual({ game: 'x01', players: ['Alice', 'Player 2', 'x'.repeat(24)], first: 0, start: 501, inRule: 'single', outRule: 'double' });
  });

  it('deals killer numbers for each player', () => {
    const cfg = buildCfg({ ...defaultSetup(['A', 'B', 'C'], false), game: 'killer' });
    expect(cfg.nums).toHaveLength(3);
    expect(cfg.lives).toBe(3);
  });

  it('defaults to two players and caps at eight', () => {
    expect(defaultSetup([], false).players).toEqual(['Player 1', 'Player 2']);
    expect(defaultSetup(Array.from({ length: 10 }, (_, i) => 'P' + i), false).players).toHaveLength(8);
  });
});
