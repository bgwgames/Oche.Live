import { pickNums } from './darts';
import type { GameConfig, GameId, InRule, OutRule } from './types';

/** The choices on the New game screen. */
export interface Setup {
  game: GameId;
  start: number;
  inRule: InRule;
  outRule: OutRule;
  cut: boolean;
  crRounds: number;
  shRounds: number;
  cuRounds: number;
  lives: number;
  players: string[];
  /** Let other phones join with a code. */
  share: boolean;
}

export function defaultSetup(players: string[], share: boolean): Setup {
  return {
    game: 'x01', start: 501, inRule: 'single', outRule: 'double', cut: false,
    crRounds: 20, shRounds: 7, cuRounds: 8, lives: 3,
    players: (players.length ? players : ['Player 1', 'Player 2']).slice(0, 8),
    share,
  };
}

/** Turns the New game choices into a game config, keeping only the options that game uses. */
export function buildCfg(su: Setup, rand: () => number = Math.random): GameConfig {
  const players = su.players.map((n, i) => n.trim().slice(0, 24) || 'Player ' + (i + 1));
  const c: GameConfig = { game: su.game, players, first: 0 };
  if (su.game === 'x01') { c.start = su.start; c.inRule = su.inRule; c.outRule = su.outRule; }
  if (su.game === 'cricket') { c.cut = su.cut; c.rounds = su.crRounds; }
  if (su.game === 'shanghai') c.rounds = su.shRounds;
  if (su.game === 'countup') c.rounds = su.cuRounds;
  if (su.game === 'killer') { c.lives = su.lives; c.nums = pickNums(players.length, rand); }
  return c;
}
