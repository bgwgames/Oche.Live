import { describe, expect, it } from 'vitest';
import { CR, compute, type GameConfig } from '../src/engine';
import { D, MISS, T, Tot } from './helpers';

/** Turns that close every cricket number for player 0, with player 1 missing in between. */
const closeAll = (): ReturnType<typeof T>[] => {
  const turns = [
    T(0, D(20, 3), D(19, 3), D(18, 3)), MISS(1),
    T(0, D(17, 3), D(16, 3), D(15, 3)), MISS(1),
    T(0, D(25, 2), D(25, 1), D(0)),
  ];
  return turns;
};

describe('Cricket', () => {
  const cricket = (over: Partial<GameConfig> = {}): GameConfig => ({ game: 'cricket', players: ['A', 'B'], first: 0, cut: false, rounds: 0, ...over });

  it('records marks and scores extra hits on an open number', () => {
    const st = compute(cricket(), [T(0, D(20, 3), D(20, 2))]);
    expect(st.P[0].marks[20]).toBe(3);
    expect(st.P[0].pts).toBe(40);
  });

  it('does not score on a number everyone has closed', () => {
    const st = compute(cricket(), [T(0, D(20, 3)), T(1, D(20, 3)), T(0, D(20, 3))]);
    expect(st.P[0].pts).toBe(0);
  });

  it('wins by closing everything level on points', () => {
    const st = compute(cricket(), closeAll());
    expect(st.over).toBe(true);
    expect(st.winners).toEqual([0]);
    expect(CR.every((n) => st.P[0].marks[n] === 3)).toBe(true);
  });

  it('does not win by closing everything while behind on points', () => {
    const turns = [MISS(0), T(1, D(20, 3), D(20, 3), D(20, 3)), ...closeAll()];
    const st = compute(cricket(), turns);
    expect(st.over).toBe(false);
    expect(st.P[1].pts).toBe(120);
  });

  it('gives points to opponents in cut-throat', () => {
    const st = compute(cricket({ cut: true }), [T(0, D(20, 3), D(20, 2))]);
    expect(st.P[0].pts).toBe(0);
    expect(st.P[1].pts).toBe(40);
  });

  it('ends at the round limit with the highest score winning', () => {
    const st = compute(cricket({ rounds: 1 }), [T(0, D(20, 3), D(20)), MISS(1)]);
    expect(st.over).toBe(true);
    expect(st.winners).toEqual([0]);
  });

  it('ends at the round limit with the lowest score winning in cut-throat', () => {
    const st = compute(cricket({ rounds: 1, cut: true }), [T(0, D(20, 3), D(20)), MISS(1)]);
    expect(st.winners).toEqual([0]);
    expect(st.P[1].pts).toBe(20);
  });
});

describe('Around the Clock', () => {
  const atc: GameConfig = { game: 'atc', players: ['A'], first: 0 };

  it('advances only on the current target', () => {
    const st = compute(atc, [T(0, D(2), D(1), D(2))]);
    expect(st.P[0].target).toBe(3);
  });

  it('finishes after 20 and the bull', () => {
    const turns = [];
    for (let i = 1; i <= 20; i += 3) turns.push(T(0, ...[D(i), D(i + 1), D(i + 2)].filter((d) => d.n <= 20)));
    turns.push(T(0, D(25)));
    const st = compute(atc, turns);
    expect(st.over).toBe(true);
    expect(st.P[0].target).toBe('done');
  });
});

describe('Shanghai', () => {
  const sh: GameConfig = { game: 'shanghai', players: ['A', 'B'], first: 0, rounds: 7 };

  it('scores only the round number', () => {
    const st = compute(sh, [T(0, D(1), D(1, 3), D(2, 3))]);
    expect(st.P[0].pts).toBe(4);
  });

  it('wins outright with a single, double and treble in one turn', () => {
    const st = compute(sh, [T(0, D(1), D(1, 2), D(1, 3))]);
    expect(st.over).toBe(true);
    expect(st.log[0].fx).toBe('shanghai');
  });

  it('uses the round number for later rounds', () => {
    const st = compute(sh, [MISS(0), MISS(1), T(0, D(2, 3))]);
    expect(st.P[0].pts).toBe(6);
  });
});

describe('Count-Up', () => {
  const cu: GameConfig = { game: 'countup', players: ['A', 'B'], first: 0, rounds: 1 };

  it('declares a draw on equal points', () => {
    const st = compute(cu, [Tot(0, 60), Tot(1, 60)]);
    expect(st.over).toBe(true);
    expect(st.winners).toEqual([0, 1]);
  });

  it('adds dart scores and counts 180s', () => {
    const st = compute({ ...cu, rounds: 2 }, [T(0, D(20, 3), D(20, 3), D(20, 3))]);
    expect(st.P[0].pts).toBe(180);
    expect(st.P[0].t180).toBe(1);
  });
});

describe('Killer', () => {
  it('becomes a killer on its own double, then knocks a player out', () => {
    const st = compute({ game: 'killer', players: ['A', 'B'], first: 0, lives: 1, nums: [5, 6] }, [T(0, D(5, 2), D(6, 2))]);
    expect(st.P[0].killer).toBe(true);
    expect(st.P[1].alive).toBe(false);
    expect(st.winners).toEqual([0]);
  });

  it('takes two lives with a treble', () => {
    const st = compute({ game: 'killer', players: ['A', 'B'], first: 0, lives: 3, nums: [5, 6] }, [T(0, D(5, 2), D(6, 3))]);
    expect(st.P[1].lives).toBe(1);
  });

  it('skips knocked-out players in the throwing order', () => {
    const cfg: GameConfig = { game: 'killer', players: ['A', 'B', 'C'], first: 0, lives: 1, nums: [5, 6, 7] };
    const st = compute(cfg, [T(0, D(5, 2), D(6, 2))]);
    expect(st.cur).toBe(2);
  });
});
