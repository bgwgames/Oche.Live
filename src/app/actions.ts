import { IMPOSSIBLE, cleanTurn, compute, pickNums, type Dart, type GameState, type LogEntry, type Turn } from '../engine';
import { S, celebrateLast, render, toast } from './state';
import { uid } from './util';
import { hostCommit, subBody } from './session';

/** Clears the turn being entered. */
export function resetDraft(): void {
  S.draft = []; S.mult = 1; S.total = ''; S.confirmUndo = false;
}

/** Whether the current player may enter a turn total instead of darts. */
export function canTotal(): boolean {
  const g = S.G?.cfg.game;
  if (g === 'countup') return true;
  if (g !== 'x01' || !S.st) return false;
  return S.st.P[S.st.cur].opened;
}

export const totalMode = (): boolean => S.tmode === 'total' && canTotal();

function draftTurn(): { total: number } | { d: Dart[] } {
  return totalMode() ? { total: parseInt(S.total || '0', 10) } : { d: S.draft.slice() };
}

/** The scoreboard as it would be if the turn being entered were submitted now. */
export function preview(): { ps: GameState; e: LogEntry } | null {
  if (!S.G || !S.st || S.st.over) return null;
  const t = { id: 'draft', p: S.st.cur, ...draftTurn() } as Turn;
  const ps = compute(S.G.cfg, S.G.turns.concat([t]));
  return { ps, e: ps.log[ps.log.length - 1] };
}

export function submitTurn(): void {
  if (!S.G || !S.st || S.st.over || S.pending) return;
  const raw = { id: uid(), p: S.st.cur, ...draftTurn() };
  if ('total' in raw && (isNaN(raw.total) || raw.total > 180 || IMPOSSIBLE.has(raw.total))) {
    toast(raw.total + ' is not possible with three darts'); return;
  }
  const t = cleanTurn(raw);
  if (!t) return;
  if (S.role === 'host' || S.role === 'local') {
    const before = S.st.log.length;
    S.G.turns.push(t); S.G.seen.push(t.id); resetDraft(); hostCommit();
    if (S.st.log.length > before) celebrateLast();
  } else {
    const nroom = S.nroom;
    if (!nroom) { toast("This phone can't send turns right now"); return; }
    const pending = { kind: 'turn' as const, t: S.G.turns.length, at: Date.now(), ...t };
    S.pending = pending;
    nroom.presence({ sub: subBody(pending) }).catch(() => { toast("Couldn't send. Try again."); S.pending = null; render(); });
    render();
  }
}

export function undoLast(): void {
  S.confirmUndo = false; S.menu = false;
  if (!S.G || !S.G.turns.length) return;
  if (S.role === 'host' || S.role === 'local') {
    S.G.turns.pop(); resetDraft(); hostCommit(); toast('Last turn removed');
  } else if (S.nroom) {
    const id = uid();
    S.pending = { kind: 'undo', id, at: Date.now() };
    S.nroom.presence({ undo: { id, t: S.G.turns.length } }).catch(() => {});
    render();
  }
}

/** Starts the same game again, rotating who throws first. Guests ask the host. */
export function doRematch(fromUI: boolean): void {
  if (!S.G) return;
  if (S.role === 'host' || S.role === 'local') {
    const c = S.G.cfg;
    c.first = ((c.first || 0) + 1) % c.players.length;
    if (c.game === 'killer') c.nums = pickNums(c.players.length);
    S.G.turns = []; resetDraft(); hostCommit();
  } else if (fromUI && S.nroom) {
    const id = uid();
    S.pending = { kind: 'rematch', id, at: Date.now() };
    S.nroom.presence({ rematch: id }).catch(() => {});
    render();
  }
}

/* Turn-entry helpers shared by the keypad and the keyboard. */

/** Adds a dart to the turn being entered. `mm` forces the multiplier (used for the bull keys). */
export function enterDart(n: number, mm = 0): void {
  if (S.draft.length >= 3) return;
  const pv = preview();
  if (pv && (pv.e.bust || pv.e.win)) return;
  const m = n === 0 ? 1 : n === 25 ? mm || (S.mult >= 2 ? 2 : 1) : S.mult;
  S.draft.push({ n, m }); S.mult = 1;
}

export function addDigit(v: string): void {
  if (S.total.length < 3 && S.total !== '0') S.total += v;
}

/** ⌫: removes the last dart or digit; with nothing entered it offers to undo the previous turn. */
export function doBack(): void {
  const total = totalMode();
  if (total ? S.total : S.draft.length) {
    if (total) S.total = S.total.slice(0, -1); else S.draft.pop();
  } else if (S.G && S.G.turns.length) {
    S.menu = false; S.confirmUndo = true;
  }
}
