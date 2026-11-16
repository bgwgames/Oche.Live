/** Core darts types shared by the engine, the app and stored games. */

export type GameId = 'x01' | 'cricket' | 'atc' | 'shanghai' | 'countup' | 'killer';

/** One dart. `n` is 0 (miss), 1–20 or 25 (outer bull, or bull when `m` is 2). `m` is 1–3. */
export interface Dart {
  n: number;
  m: number;
}

export interface DartsTurn {
  id: string;
  p: number;
  d: Dart[];
}

/** A turn entered as a single total (X01 and Count-Up only). */
export interface TotalTurn {
  id: string;
  p: number;
  total: number;
}

export type Turn = DartsTurn | TotalTurn;

export type InRule = 'single' | 'double';
export type OutRule = 'single' | 'double' | 'master';

export interface GameConfig {
  game: GameId;
  players: string[];
  /** Index of the player who throws first. Rotates on rematch. */
  first: number;
  start?: number;
  inRule?: InRule;
  outRule?: OutRule;
  cut?: boolean;
  /** Round limit; 0 or absent means none. */
  rounds?: number;
  lives?: number;
  /** Killer: each player's number, by player index. */
  nums?: number[];
}

/** What a finished turn triggers on screen. */
export type Fx = '180' | 'bust' | 'win' | 'shanghai' | 'killer' | 'out' | null;

export interface LogEntry {
  id: string;
  p: number;
  /** The darts as text, e.g. "T20 · 19 · D16". */
  txt: string;
  /** The turn's result as text, e.g. "140", "BUST", "+40". */
  val: string;
  bust: boolean;
  win: boolean;
  fx: Fx;
}

/** Around the Clock target: 1–20, 25 for the bull, or done. */
export type AtcTarget = number | 'done';

export interface PlayerState {
  name: string;
  i: number;
  pts: number;
  darts: number;
  best: number;
  t180: number;
  turns: number;
  alive: boolean;
  last: LogEntry | null;
  /** X01 */
  rem: number;
  opened: boolean;
  /** Cricket marks per number (15–20, 25). */
  marks: Record<number, number>;
  /** Around the Clock */
  target: AtcTarget;
  /** Killer */
  num: number;
  lives: number;
  killer: boolean;
}

export interface GameState {
  P: PlayerState[];
  /** Index of the player to throw next. */
  cur: number;
  over: boolean;
  winners: number[];
  log: LogEntry[];
  round: number;
  applied: number;
  rounds: number;
}
