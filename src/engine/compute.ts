import { CR, dl, dv } from './darts';
import type { GameConfig, GameState, LogEntry, PlayerState, Turn } from './types';

/**
 * Replays a game from its config and turn list. Pure: the same input always gives the same state,
 * so every phone can derive the scoreboard from the shared turn list alone.
 * Turns that aren't for the player due to throw are ignored.
 */
export function compute(cfg: GameConfig, turns: Turn[]): GameState {
  const np = cfg.players.length;
  const g = cfg.game;
  const P: PlayerState[] = cfg.players.map((name, i) => ({
    name, i, pts: 0, darts: 0, best: 0, t180: 0, turns: 0, alive: true, last: null,
    rem: 0, opened: true, marks: {}, target: 1, num: 0, lives: 0, killer: false,
  }));
  if (g === 'x01') P.forEach((p) => { p.rem = cfg.start ?? 501; p.opened = cfg.inRule !== 'double'; });
  if (g === 'cricket') P.forEach((p) => { CR.forEach((n) => (p.marks[n] = 0)); });
  if (g === 'killer') P.forEach((p, i) => { p.num = cfg.nums?.[i] ?? 0; p.lives = cfg.lives ?? 3; });

  let cur = (cfg.first || 0) % np;
  let applied = 0;
  let over = false;
  let winners: number[] = [];
  const log: LogEntry[] = [];
  const rounds = cfg.rounds || 0;

  const nextAlive = (from: number): number => {
    for (let k = 1; k <= np; k++) {
      const j = (from + k) % np;
      if (P[j].alive) return j;
    }
    return from;
  };
  const finishByPoints = (low: boolean): void => {
    over = true;
    const vals = P.map((p) => p.pts);
    const best = low ? Math.min(...vals) : Math.max(...vals);
    winners = P.filter((p) => p.pts === best).map((p) => p.i);
  };

  for (const t of turns) {
    if (over) break;
    if (t.p !== cur) continue;
    const p = P[cur];
    const e: LogEntry = { id: t.id, p: cur, txt: '', val: '', bust: false, win: false, fx: null };
    const darts = 'd' in t && Array.isArray(t.d) ? t.d : null;
    const total = 'total' in t ? t.total : 0;
    e.txt = darts ? (darts.length ? darts.map(dl).join(' · ') : 'No score') : 'Total';
    const round = Math.floor(applied / np) + 1;

    if (g === 'x01') {
      const start = p.rem;
      let rem = p.rem;
      let opened = p.opened;
      let bust = false;
      let win = false;
      let used = 3;
      if (!darts) {
        const v = total;
        if (!opened && v > 0) opened = true;
        const nr = rem - v;
        if (nr < 0 || (nr === 1 && cfg.outRule !== 'single')) bust = true;
        else { rem = nr; if (nr === 0) win = true; }
      } else {
        for (let k = 0; k < darts.length; k++) {
          const d = darts[k];
          const v = dv(d);
          if (!opened) { if (d.m === 2 && d.n) opened = true; else continue; }
          const nr = rem - v;
          const ok = cfg.outRule === 'single' || (cfg.outRule === 'double' ? d.m === 2 : d.m >= 2);
          if (nr < 0 || (nr === 1 && cfg.outRule !== 'single') || (nr === 0 && !ok)) { bust = true; break; }
          rem = nr;
          if (nr === 0) { win = true; used = k + 1; break; }
        }
      }
      if (bust) rem = start;
      const sc = start - rem;
      p.rem = rem; p.opened = opened; p.pts += sc; p.darts += used; p.best = Math.max(p.best, sc);
      if (sc === 180) { p.t180++; e.fx = '180'; }
      e.val = bust ? 'BUST' : String(sc);
      e.bust = bust;
      if (bust) e.fx = 'bust';
      if (win) { e.win = true; over = true; winners = [cur]; e.fx = 'win'; }
    } else if (g === 'cricket') {
      let gained = 0;
      for (const d of darts || []) {
        if (!CR.includes(d.n)) continue;
        const hits = d.m;
        const need = Math.max(0, 3 - p.marks[d.n]);
        const close = Math.min(hits, need);
        const extra = hits - close;
        p.marks[d.n] += close;
        if (extra > 0) {
          const others = P.filter((o) => o !== p);
          const v = (d.n === 25 ? 25 : d.n) * extra;
          if (cfg.cut) others.forEach((o) => { if (o.marks[d.n] < 3) o.pts += v; });
          else if (!others.every((o) => o.marks[d.n] >= 3)) { p.pts += v; gained += v; }
        }
        const allClosed = CR.every((n) => p.marks[n] >= 3);
        if (allClosed) {
          const ov = P.filter((o) => o !== p).map((o) => o.pts);
          if (cfg.cut ? p.pts <= Math.min(...ov) : p.pts >= Math.max(...ov)) {
            e.win = true; over = true; winners = [cur]; e.fx = 'win'; break;
          }
        }
      }
      p.darts += 3;
      e.val = gained ? '+' + gained : '';
    } else if (g === 'atc') {
      const before = p.target;
      for (const d of darts || []) {
        if (p.target === 'done') break;
        if (d.n && d.n === p.target) p.target = p.target === 20 ? 25 : p.target === 25 ? 'done' : p.target + 1;
      }
      p.darts += 3;
      if (p.target === 'done') { e.win = true; over = true; winners = [cur]; e.fx = 'win'; e.val = 'Done'; }
      else e.val = p.target === before ? '' : '→ ' + (p.target === 25 ? 'Bull' : p.target);
    } else if (g === 'shanghai') {
      let sc = 0;
      const seen = new Set<number>();
      for (const d of darts || []) { if (d.n === round) { sc += round * d.m; seen.add(d.m); } }
      p.pts += sc; p.darts += 3; p.best = Math.max(p.best, sc);
      e.val = String(sc);
      if (seen.size === 3 && round <= 20) { e.win = true; over = true; winners = [cur]; e.fx = 'shanghai'; }
    } else if (g === 'countup') {
      const sc = darts ? darts.reduce((a, d) => a + dv(d), 0) : total;
      p.pts += sc; p.darts += 3; p.best = Math.max(p.best, sc);
      if (sc === 180) { p.t180++; e.fx = '180'; }
      e.val = String(sc);
    } else if (g === 'killer') {
      const notes: string[] = [];
      for (const d of darts || []) {
        if (!d.n || d.n === 25) continue;
        if (d.n === p.num && d.m === 2 && !p.killer) { p.killer = true; notes.push('Killer!'); e.fx = e.fx || 'killer'; continue; }
        if (p.killer) {
          const o = P.find((o) => o.num === d.n && o !== p && o.alive);
          if (o) {
            const dmg = d.m === 2 ? 1 : d.m === 3 ? 2 : 0;
            if (dmg) {
              o.lives = Math.max(0, o.lives - dmg);
              if (o.lives === 0) { o.alive = false; notes.push(o.name + ' out'); e.fx = 'out'; }
            }
          }
        }
        if (P.filter((o) => o.alive).length === 1) { e.win = true; over = true; winners = [cur]; e.fx = 'win'; break; }
      }
      p.darts += 3;
      e.val = notes.join(', ');
    }

    p.turns++; p.last = e; log.push(e); applied++;
    if (!over) {
      if (rounds && (g === 'cricket' || g === 'shanghai' || g === 'countup') && applied >= rounds * np) {
        finishByPoints(g === 'cricket' && !!cfg.cut);
      } else cur = nextAlive(cur);
    }
  }
  return { P, cur, over, winners, log, round: Math.floor(applied / np) + 1, applied, rounds };
}
