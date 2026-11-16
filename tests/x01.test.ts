import { describe, expect, it } from 'vitest';
import { compute, type GameConfig } from '../src/engine';
import { D, MISS, T, T180, Tot } from './helpers';

const x01 = (over: Partial<GameConfig> = {}): GameConfig => ({
  game: 'x01', players: ['A', 'B'], first: 0, start: 501, inRule: 'single', outRule: 'double', ...over,
});

describe('X01', () => {
  it('scores a 180 and moves to the next player', () => {
    const st = compute(x01(), [T180(0)]);
    expect(st.P[0].rem).toBe(321);
    expect(st.P[0].t180).toBe(1);
    expect(st.log[0].fx).toBe('180');
    expect(st.cur).toBe(1);
  });

  it('busts when leaving 1 on a double-out finish', () => {
    const st = compute(x01({ start: 41 }), [T(0, D(20), D(20))]);
    expect(st.P[0].rem).toBe(41);
    expect(st.log[0].bust).toBe(true);
    expect(st.log[0].val).toBe('BUST');
  });

  it('busts when finishing on a single with double out', () => {
    const st = compute(x01({ start: 20 }), [T(0, D(20))]);
    expect(st.P[0].rem).toBe(20);
    expect(st.log[0].bust).toBe(true);
  });

  it('wins on a double and counts only the darts used', () => {
    const st = compute(x01({ start: 41 }), [T(0, D(1), D(20, 2))]);
    expect(st.over).toBe(true);
    expect(st.winners).toEqual([0]);
    expect(st.P[0].darts).toBe(2);
  });

  it('allows the bull as a double finish', () => {
    const st = compute(x01({ start: 50 }), [T(0, D(25, 2))]);
    expect(st.over).toBe(true);
  });

  it('allows a treble finish with master out but not a single', () => {
    expect(compute(x01({ start: 60, outRule: 'master' }), [T(0, D(20, 3))]).over).toBe(true);
    expect(compute(x01({ start: 20, outRule: 'master' }), [T(0, D(20))]).log[0].bust).toBe(true);
  });

  it('allows any finish and leaving 1 with straight out', () => {
    expect(compute(x01({ start: 20, outRule: 'single' }), [T(0, D(20))]).over).toBe(true);
    expect(compute(x01({ start: 21, outRule: 'single' }), [T(0, D(20))]).P[0].rem).toBe(1);
  });

  it('ignores darts before the opening double with double in', () => {
    const st = compute(x01({ inRule: 'double' }), [T(0, D(20), D(20, 2), D(20, 3))]);
    expect(st.P[0].rem).toBe(401);
    expect(st.P[0].opened).toBe(true);
  });

  it('stays unopened without a double', () => {
    const st = compute(x01({ inRule: 'double' }), [T180(0)]);
    expect(st.P[0].rem).toBe(501);
    expect(st.P[0].opened).toBe(false);
  });

  it('accepts turn totals and busts them like darts', () => {
    const st = compute(x01({ start: 101 }), [Tot(0, 60), MISS(1), Tot(0, 40)]);
    expect(st.P[0].rem).toBe(41);
    expect(st.log[2].bust).toBe(true);
  });

  it('computes the three-dart average and best', () => {
    const st = compute(x01(), [Tot(0, 100), MISS(1), Tot(0, 60)]);
    expect((st.P[0].pts / st.P[0].darts) * 3).toBe(80);
    expect(st.P[0].best).toBe(100);
  });

  it('ignores a turn for the wrong player', () => {
    const st = compute(x01(), [T180(1)]);
    expect(st.log).toHaveLength(0);
    expect(st.cur).toBe(0);
  });

  it('starts with the configured first thrower', () => {
    expect(compute(x01({ first: 1 }), []).cur).toBe(1);
  });

  it('stops applying turns once the game is won', () => {
    const st = compute(x01({ start: 40 }), [T(0, D(20, 2)), T180(1)]);
    expect(st.log).toHaveLength(1);
  });
});
