import { buildCfg, cleanTurn, compute } from '../engine';
import { S, TAB, celebrateLast, render, syncOK, toast, type Pending, type StoredGame } from './state';
import type { DbError, Json } from './runtime';
import { clone, ls, sleep } from './util';
import { doRematch, resetDraft } from './actions';
import { wake } from './wake';

/** Saved in localStorage so a reload returns to the same game. */
interface LastGame {
  code?: string;
  host?: boolean;
  /** The tab that was hosting, so a reload only resumes hosting if nobody else took over. */
  tab?: string;
  local?: boolean;
}

let tmGame: string | null = null;
/** Recomputes the scoreboard from the stored turns. */
export function recompute(): void {
  S.st = S.G ? compute(S.G.cfg, S.G.turns) : null;
  /* Each game remembers whether this phone last scored it dart by dart or by turn total. */
  if (S.G && S.G.cfg.game !== tmGame) {
    tmGame = S.G.cfg.game;
    S.tmode = ls.get<Record<string, 'darts' | 'total'>>('oche.tmode')?.[tmGame] || 'darts';
  }
}

/** Picks an unused 4-letter code. Codes idle for 12 hours can be reused. */
async function freeCode(): Promise<string | null> {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let k = 0; k < 8; k++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)];
    try {
      const s = await S.db!.doc<StoredGame>('games/' + c).get();
      if (!s.exists || Date.now() - (s.data().at || 0) > 12 * 3600e3) return c;
    } catch {
      return c;
    }
  }
  return null;
}

export async function startGame(): Promise<void> {
  const su = S.setup!;
  ls.set('oche.names', su.players);
  const G: StoredGame = { cfg: buildCfg(su), turns: [], seen: [], useen: [], host: TAB, hostAt: Date.now(), at: Date.now() };
  resetDraft();
  if (su.share && syncOK()) {
    S.role = 'starting'; S.code = null; S.G = null; S.view = 'game'; S.loadErr = ''; render();
    const code = await freeCode();
    if (S.role !== 'starting') return; /* left while the code was being picked */
    if (!code) {
      S.role = null; S.view = 'setup';
      S.loadErr = 'Could not reach the game server. Check your signal and try again, or turn off sharing to play on this phone.';
      render(); return;
    }
    S.code = code; S.role = 'host'; S.G = G; recompute();
    ls.set('oche.last', { code, host: true, tab: TAB } satisfies LastGame);
    attach(code); hostCommit();
  } else {
    S.code = null; S.role = 'local'; S.G = G; recompute(); S.view = 'game';
    ls.set('oche.last', { local: true } satisfies LastGame); ls.set('oche.local', G); render();
  }
  wake();
}

/** Saves the game after this phone (host or local) changed it. */
export function hostCommit(): void {
  if (!S.G) return;
  S.G.at = Date.now(); recompute();
  if (S.role === 'local') { ls.set('oche.local', S.G); render(); return; }
  ls.set('oche.bak.' + S.code, S.G);
  void queueWrite(); render();
}

let writing = false;
let dirty = false;
/** Errors that retrying cannot fix. The first group also means this phone may not write at all. */
const NO_ACCESS = new Set(['revoked', 'not_granted', 'capability_disabled', 'capability_removed']);
export const FATAL = new Set([...NO_ACCESS, 'invalid_argument', 'transform_error', 'quota_exceeded']);

async function queueWrite(): Promise<void> {
  if (S.writeErr && NO_ACCESS.has(S.writeErr)) return; /* lost write access for this page load: don't retry or re-toast every turn */
  dirty = true;
  if (writing) return;
  writing = true; S.saving = true;
  let delay = 1500;
  let failed = false;
  while (dirty && S.role === 'host') {
    dirty = false;
    const ref = S.db!.doc<StoredGame>('games/' + S.code);
    try {
      /* After a failed save (e.g. no signal), another phone may have taken over meanwhile.
         Check before re-sending so a stale copy never overwrites the new host's game. */
      if (failed) {
        const cur = await ref.get();
        if (cur.exists && demoteIfReplaced(cur.data())) break;
      }
      if ((S.role as string) !== 'host') break;
      await ref.set(clone(S.G!));
      S.writeErr = null; delay = 1500; failed = false;
    } catch (e) {
      S.writeErr = (e as DbError)?.code || 'unavailable'; failed = true;
      if (FATAL.has(S.writeErr)) {
        if (NO_ACCESS.has(S.writeErr)) S.canWrite = false;
        toast("This game can't be saved online right now. Scores are kept on this phone.");
        break;
      }
      dirty = true; render();
      await sleep(delay + Math.random() * 800);
      delay = Math.min(delay * 2, 15000);
    }
  }
  writing = false; S.saving = false; render();
}

let loadTimer: ReturnType<typeof setTimeout> | undefined;
/** Subscribes to a shared game and joins its room. */
export function attach(code: string): void {
  detach();
  S.code = code; S.hostSeen = Date.now();
  const ref = S.db!.doc<StoredGame>('games/' + code);
  let first = true;
  loadTimer = setTimeout(() => { if (!S.G) { S.loadErr = 'Still trying to reach the game. Check your signal.'; render(); } }, 10000);
  S.sub = ref.onSnapshot((snap) => {
    if (!snap.exists) {
      if (!snap.metadata.fromCache && !S.G && S.role !== 'host') {
        clearTimeout(loadTimer);
        S.joinErr = 'No game with code ' + code + '. Check the code with the host.';
        S.view = 'join'; S.code = null; detach(); ls.del('oche.last'); render();
      }
      return;
    }
    if (!snap.metadata.fromCache) { clearTimeout(loadTimer); S.loadErr = ''; }
    const d = snap.data();
    if (S.role === 'host') {
      first = false;
      demoteIfReplaced(d);
      render(); return;
    }
    const prevLen = S.G ? S.G.turns.length : -1;
    S.G = clone(d); recompute();
    /* A returning viewer may get a cached copy first; only the first LIVE snapshot decides whether to resume hosting. */
    if (first && !snap.metadata.fromCache) {
      first = false;
      const last = ls.get<LastGame>('oche.last');
      /* Resume only if no other phone took over while this one was away (older saves have no tab: allow). */
      if (last && last.host && last.code === code && S.canWrite !== false && (!last.tab || d.host === last.tab)) {
        const bak = ls.get<StoredGame>('oche.bak.' + code);
        if (bak && bak.turns && bak.turns.length > S.G.turns.length && S.G.turns.every((t, i) => bak.turns[i] && bak.turns[i].id === t.id)) S.G = bak;
        takeOver(true); return;
      }
    }
    checkPending();
    if (prevLen >= 0 && S.G.turns.length > prevLen) celebrateLast();
    render();
  }, () => { S.loadErr = 'Lost the connection to this game. Reopen the page to reconnect.'; render(); });

  if (S.room) {
    S.room.join('darts-' + code.toLowerCase()).then((nr) => {
      S.nroom = nr;
      nr.presence({ tab: TAB, role: S.role === 'host' ? 'host' : 'player' }).catch(() => {});
      nr.onPeers((ch) => {
        S.peers = ch.peers;
        if (S.peers.some((p) => p.presence && p.presence.tab === (S.G && S.G.host))) S.hostSeen = Date.now();
        processPeers(); render();
      });
      if (S.pending && S.pending.kind === 'turn') nr.presence({ sub: subBody(S.pending) }).catch(() => {});
    }).catch(() => { S.nroom = null; render(); });
  }
}

export function detach(): void {
  if (S.sub) { try { S.sub(); } catch { /* already closed */ } S.sub = null; }
  if (S.nroom) { S.nroom.leave().catch(() => {}); S.nroom = null; }
  S.peers = [];
  clearTimeout(loadTimer);
}

/** If the stored game names a newer host than this phone, step down and adopt its state. */
function demoteIfReplaced(d: StoredGame): boolean {
  if (S.role !== 'host' || !d || d.host === TAB || (d.hostAt || 0) <= (S.G!.hostAt || 0)) return false;
  S.role = 'guest'; S.G = clone(d); recompute(); announceRole();
  ls.set('oche.last', { code: S.code ?? undefined } satisfies LastGame);
  toast('Another phone took over hosting');
  return true;
}

function announceRole(): void {
  if (S.nroom) S.nroom.presence({ tab: TAB, role: S.role === 'host' ? 'host' : 'player' }).catch(() => {});
}

export function takeOver(silent: boolean): void {
  if (!S.G) return;
  S.role = 'host'; S.G.host = TAB; S.G.hostAt = Date.now();
  ls.set('oche.last', { code: S.code ?? undefined, host: true, tab: TAB } satisfies LastGame);
  announceRole(); processPeers(); hostCommit();
  if (!silent) toast('This phone is now the host');
}

export function hostPresent(): boolean {
  return !!S.G && S.peers.some((p) => p.presence && p.presence.tab === S.G!.host);
}

/** Host only: applies turns, undos and rematches that guests posted in their presence. */
function processPeers(): void {
  if (S.role !== 'host' || !S.G || !S.st) return;
  let changed = false;
  for (const pr of S.peers) {
    if (pr.sameTab || !pr.presence) continue;
    const s = pr.presence.sub as Record<string, Json> | null | undefined;
    if (s && typeof s.id === 'string' && !S.G.seen.includes(s.id)) {
      S.G.seen.push(s.id);
      if (S.G.seen.length > 150) S.G.seen.splice(0, S.G.seen.length - 150);
      changed = true;
      const t = cleanTurn(s);
      if (t && s.t === S.G.turns.length && !S.st.over && t.p === S.st.cur && !S.G.turns.some((x) => x.id === t.id)) S.G.turns.push(t);
    }
    const u = pr.presence.undo as Record<string, Json> | null | undefined;
    if (u && typeof u.id === 'string' && !S.G.useen.includes(u.id)) {
      S.G.useen.push(u.id);
      if (S.G.useen.length > 60) S.G.useen.splice(0, S.G.useen.length - 60);
      changed = true;
      if (u.t === S.G.turns.length && S.G.turns.length) S.G.turns.pop();
    }
    const r = pr.presence.rematch;
    if (r && typeof r === 'string' && !S.G.useen.includes(r)) {
      S.G.useen.push(r); changed = true;
      if (S.st.over) doRematch(false);
    }
  }
  if (changed) {
    const before = S.st.log.length;
    hostCommit();
    if (S.st.log.length > before) celebrateLast();
  }
}

/** Guest: clears a pending request once the host has applied (or rejected) it. */
function checkPending(): void {
  const pd = S.pending;
  if (!pd || !S.G) return;
  if (pd.kind === 'turn') {
    if (S.G.turns.some((t) => t.id === pd.id)) { clearPending(); resetDraft(); }
    else if (S.G.seen.includes(pd.id)) { clearPending(); toast('That turn was already entered on another phone'); resetDraft(); }
  } else if (S.G.useen.includes(pd.id)) clearPending();
}

/** The part of a pending turn that is posted to the room. */
export function subBody(pd: Extract<Pending, { kind: 'turn' }>): Record<string, Json> {
  const o: Record<string, Json> = { id: pd.id, p: pd.p, t: pd.t };
  if ('d' in pd) o.d = pd.d.map((x) => ({ n: x.n, m: x.m }));
  else o.total = pd.total;
  return o;
}

function clearPending(): void {
  S.pending = null;
  if (S.nroom) S.nroom.presence({ sub: null, undo: null, rematch: null }).catch(() => {});
}

export function leave(): void {
  detach();
  S.G = null; S.st = null; S.code = null; S.role = null; S.pending = null; S.menu = false;
  ls.del('oche.last'); S.view = 'home'; render();
}

export function joinGame(): void {
  const c = S.joinCode.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(c)) { S.joinErr = 'Codes are 4 letters.'; render(); return; }
  S.joinErr = ''; S.role = 'guest'; S.G = null; S.view = 'game';
  ls.set('oche.last', { code: c } satisfies LastGame);
  resetDraft(); attach(c); render(); wake();
}

/** Reopens the game this phone was in before a reload. */
export function resume(): void {
  const last = ls.get<LastGame>('oche.last');
  if (last && last.local) {
    const G = ls.get<StoredGame>('oche.local');
    if (G && G.cfg) { S.G = G; S.role = 'local'; recompute(); S.view = 'game'; wake(); }
  } else if (last && last.code && S.db) {
    S.role = 'guest'; S.view = 'game'; attach(last.code); wake();
  }
}

