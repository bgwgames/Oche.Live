import type { Dart, GameConfig, GameState, Setup, Turn } from '../engine';
import type { Db, JoinedRoom, Peer, Room, User } from './runtime';

/** A game as stored and shared between phones. The scoreboard is always recomputed from `turns`. */
export interface StoredGame {
  cfg: GameConfig;
  turns: Turn[];
  /** Ids of turns already handled, so a turn sent twice is applied once. */
  seen: string[];
  /** Ids of undo and rematch requests already handled. */
  useen: string[];
  /** The tab id of the phone that is hosting. */
  host: string;
  hostAt: number;
  at: number;
}

export type View = 'home' | 'setup' | 'join' | 'game';
/** `local`: this phone only. `host`/`guest`: a shared game. `starting`: picking a code. */
export type Role = 'local' | 'host' | 'guest' | 'starting' | null;
export type EntryMode = 'darts' | 'total';

/** A turn, undo or rematch a guest has sent and is waiting for the host to apply. */
export type Pending =
  | ({ kind: 'turn'; t: number; at: number } & Turn)
  | { kind: 'undo'; id: string; at: number }
  | { kind: 'rematch'; id: string; at: number };

export interface AppState {
  db: Db | null;
  room: Room | null;
  user: User | null;
  /** Whether this viewer may write the shared game: null when not told. */
  canWrite: boolean | null;
  ready: boolean;
  view: View;
  setup: Setup | null;
  joinCode: string;
  joinErr: string;
  code: string | null;
  role: Role;
  G: StoredGame | null;
  st: GameState | null;
  sub: (() => void) | null;
  nroom: JoinedRoom | null;
  peers: Peer[];
  hostSeen: number;
  draft: Dart[];
  mult: number;
  tmode: EntryMode;
  total: string;
  pending: Pending | null;
  menu: boolean;
  confirmUndo: boolean;
  saving: boolean;
  writeErr: string | null;
  loadErr: string;
}

/** This page load's id, used to tell which phone is the host. */
export const TAB = Math.random().toString(36).slice(2, 10);

export const S: AppState = {
  db: null, room: null, user: null, canWrite: null, ready: false,
  view: 'home', setup: null, joinCode: '', joinErr: '',
  code: null, role: null, G: null, st: null, sub: null, nroom: null, peers: [], hostSeen: 0,
  draft: [], mult: 1, tmode: 'darts', total: '', pending: null, menu: false, confirmUndo: false,
  saving: false, writeErr: null, loadErr: '',
};

/** Whether this phone can start a shared game. */
export const syncOK = (): boolean => !!(S.db && S.canWrite !== false);

/* The UI registers its renderer here, so app logic can ask for a redraw without importing the UI. */
let renderer: () => void = () => {};
export function setRenderer(fn: () => void): void { renderer = fn; }
export function render(): void { renderer(); }

/* The same for short messages. */
let toaster: (msg: string) => void = () => {};
export function setToaster(fn: (msg: string) => void): void { toaster = fn; }
export function toast(msg: string): void { toaster(msg); }

/* And for celebrating the turn just entered (180, game shot, bust...). */
let celebrator: () => void = () => {};
export function setCelebrator(fn: () => void): void { celebrator = fn; }
export function celebrateLast(): void { celebrator(); }
