import { CR, GAMES, NUMS, checkout, dl, dv, type GameConfig, type GameState, type LogEntry, type PlayerState } from '../engine';
import { S, syncOK } from '../app/state';
import { esc } from '../app/util';
import { canTotal, preview, totalMode } from '../app/actions';
import { FATAL, hostPresent } from '../app/session';

type Preview = ReturnType<typeof preview>;

function statusLine(): string {
  if (!S.ready) return '<span class="status"><span class="dot wait"></span>Connecting</span>';
  if (syncOK()) return '<span class="status"><span class="dot ok"></span>Multi-phone ready</span>';
  if (S.db) return '<span class="status"><span class="dot wait"></span>Join only</span>';
  return '<span class="status"><span class="dot"></span>This phone only</span>';
}

export function vHome(): string {
  let n = '';
  if (S.ready && !S.db) n = '<p class="note">Multi-phone games need you to be signed in to Claude with access to this page. You can still score a full game on this phone and pass it around.</p>';
  else if (S.ready && S.canWrite === false) n = "<p class=\"note\">You can join a friend's game from this phone. Starting a shared game needs edit access to this page, so new games you start here stay on this phone.</p>";
  return `<header class="brand"><h1>Oche<span>.</span>Live</h1>${statusLine()}</header>
  <p class="note" style="margin:0">Live darts scoring for the whole group. One phone hosts, everyone else joins with a code and enters their own throws.</p>
  <button class="big-btn primary" data-a="new"><strong>New game</strong><small>X01, Cricket, Around the Clock, Shanghai, Count-Up, Killer</small></button>
  <button class="big-btn" data-a="join" ${S.ready && !S.db ? 'disabled' : ''}><strong>Join a game</strong><small>Enter the 4-letter code from the host's phone</small></button>${n}`;
}

function seg(key: string, opts: [string | number, string][], val: unknown): string {
  return '<div class="seg" role="group">' + opts.map(([v, l]) => `<button data-a="opt" data-k="${key}" data-v="${v}" aria-pressed="${String(v) === String(val)}">${l}</button>`).join('') + '</div>';
}

export function vSetup(): string {
  const su = S.setup!;
  let o = '';
  if (su.game === 'x01') o = `<div class="optrow"><span class="eyebrow">Starting score</span>${seg('start', [[301, '301'], [501, '501'], [701, '701']], su.start)}</div>
    <div class="optrow"><span class="eyebrow">Start</span>${seg('inRule', [['single', 'Straight in'], ['double', 'Double in']], su.inRule)}</div>
    <div class="optrow"><span class="eyebrow">Finish</span>${seg('outRule', [['double', 'Double out'], ['single', 'Straight out'], ['master', 'Master out']], su.outRule)}</div>`;
  if (su.game === 'cricket') o = `<div class="optrow"><span class="eyebrow">Scoring</span>${seg('cut', [['false', 'Standard'], ['true', 'Cut-throat']], su.cut)}</div>
    <div class="optrow"><span class="eyebrow">Round limit</span>${seg('crRounds', [[15, '15'], [20, '20'], [0, 'None']], su.crRounds)}</div>`;
  if (su.game === 'shanghai') o = `<div class="optrow"><span class="eyebrow">Rounds</span>${seg('shRounds', [[7, '1 to 7'], [20, '1 to 20']], su.shRounds)}</div>`;
  if (su.game === 'countup') o = `<div class="optrow"><span class="eyebrow">Rounds</span>${seg('cuRounds', [[8, '8'], [10, '10'], [12, '12']], su.cuRounds)}</div>`;
  if (su.game === 'killer') o = `<div class="optrow"><span class="eyebrow">Lives</span>${seg('lives', [[3, '3'], [5, '5']], su.lives)}</div><p class="note" style="margin:0">Each player gets a random number. Doubles take one life, trebles take two.</p>`;
  const share = syncOK()
    ? `<button class="toggle" data-a="share" aria-pressed="${su.share}"><span><b>Let friends join from their phones</b><br><span class="note">You get a code to share. Leave off to pass this phone around.</span></span><span class="sw"></span></button>`
    : '<p class="note" style="margin:0">This game will run on this phone only. Pass it to whoever is throwing.</p>';
  return `<button class="back" data-a="home">← Back</button><h2>New game</h2>
  <div class="games">${Object.entries(GAMES).map(([k, g]) => `<button class="game-opt" data-a="game" data-v="${k}" aria-pressed="${su.game === k}"><span class="radio"></span><b>${g.name}</b><span>${g.blurb}</span></button>`).join('')}</div>
  ${o ? `<div class="panel">${o}</div>` : ''}
  <div class="panel"><span class="eyebrow">Players in throwing order</span><div class="plist">${su.players.map((n, i) => `<div class="prow"><span class="num">${i + 1}</span><input id="pn${i}" data-i="${i}" value="${esc(n)}" maxlength="24" autocomplete="off" aria-label="Player ${i + 1} name">${su.players.length > 1 ? `<button data-a="rm" data-i="${i}" aria-label="Remove player ${i + 1}">×</button>` : ''}</div>`).join('')}</div>
  ${su.players.length < 8 ? '<button class="ghost" data-a="add">+ Add player</button>' : ''}</div>
  <div class="panel">${share}</div>
  ${S.loadErr ? `<p class="err">${esc(S.loadErr)}</p>` : ''}
  <button class="cta" data-a="start">Start game</button>`;
}

export function vJoin(): string {
  return `<button class="back" data-a="home">← Back</button><h2>Join a game</h2>
  <p class="note" style="margin:0">Ask the host for the code at the top of their screen.</p>
  <div class="codebox"><input id="code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" value="${esc(S.joinCode)}" aria-label="Game code"></div>
  ${S.joinErr ? `<p class="err">${esc(S.joinErr)}</p>` : ''}
  <button class="cta" data-a="dojoin">Join</button>`;
}

/** Cricket marks: one, two (X) and three (closed). */
const MK = ['', '<svg class="mk" viewBox="0 0 26 26"><path d="M7 20L19 6"/></svg>', '<svg class="mk" viewBox="0 0 26 26"><path d="M7 20L19 6M7 6l12 14"/></svg>', '<svg class="mk" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10"/><path d="M7 19L19 7M7 7l12 12"/></svg>'];

/** Shown while there is no scoreboard yet: creating a shared game, or joining one. */
export function vLoading(): string {
  if (S.role === 'starting') return `<div class="gbar"><div class="title"><span class="eyebrow">New game</span><b>${esc(GAMES[S.setup!.game].name)}</b></div><button class="iconbtn" data-a="leave" aria-label="Cancel">×</button></div>
    <div class="waiting"><span class="spin"></span>Getting a game code…</div>`;
  return `<div class="gbar"><div class="title"><span class="eyebrow">Joining</span><b>${esc(S.code || '')}</b></div><button class="iconbtn" data-a="leave" aria-label="Leave">×</button></div>
    <div class="waiting"><span class="spin"></span>${S.loadErr ? esc(S.loadErr) : 'Loading the scoreboard…'}</div>`;
}

export interface GameView {
  top: string[];
  scroll: string[];
  panel: string[];
  sheet: string;
}

/** The game screen as regions: top bar, scrollable scoreboard, keypad pinned to the thumb, and a bottom sheet. */
export function vGame(): GameView {
  const st = S.st!;
  const cfg = S.G!.cfg;
  const g = cfg.game;
  const pv = preview();
  const sub = g === 'x01' ? `${cfg.start} · ${cfg.inRule === 'double' ? 'double in · ' : ''}${cfg.outRule} out`
    : g === 'cricket' ? (cfg.cut ? 'Cut-throat' : 'Standard') + (st.rounds ? ` · round ${Math.min(st.round, st.rounds)} of ${st.rounds}` : ` · round ${st.round}`)
    : g === 'shanghai' || g === 'countup' ? `Round ${Math.min(st.round, st.rounds)} of ${st.rounds}${g === 'shanghai' && !st.over ? ` · aim for ${st.round}` : ''}`
    : g === 'killer' ? `${cfg.lives} lives` : '';
  let sync = '';
  if (S.role === 'local') sync = '<span class="status"><span class="dot"></span>This phone</span>';
  else if (S.role === 'host') sync = S.writeErr && FATAL.has(S.writeErr) ? '<span class="status"><span class="dot"></span>Not saving</span>'
    : `<span class="status"><span class="dot ${S.writeErr ? 'wait' : 'ok'}"></span>${S.writeErr ? 'Saving…' : 'Hosting'}</span>`;
  else { const hp = hostPresent(); sync = `<span class="status"><span class="dot ${hp ? 'ok' : 'wait'}"></span>${hp ? 'Live' : 'Host offline'}</span>`; }
  const top = [`<div class="gbar"><div class="title"><span class="eyebrow">${esc(GAMES[g].name)}</span><b>${esc(sub)}</b>${sync}</div>
    <div style="display:flex;gap:8px;align-items:center">${S.code ? `<span class="chip" aria-label="Game code">${S.code}</span>` : ''}<button class="iconbtn" data-a="menu" aria-label="Game menu" aria-expanded="${S.menu}">⋯</button></div></div>`];
  let sheet = '';
  if (S.confirmUndo) {
    const e = st.log[st.log.length - 1];
    const nm = e ? cfg.players[e.p] : '';
    sheet = `<div class="scrim" data-a="noundo"></div><div class="sheet confirm" role="dialog" aria-label="Undo last turn"><b>Undo ${esc(nm)}'s last turn${e ? ' (' + esc(e.txt) + ')' : ''}?</b><div class="btns"><button data-a="noundo">Keep it</button><button class="danger" data-a="doundo">Undo</button></div></div>`;
  } else if (S.menu) {
    sheet = `<div class="scrim" data-a="menu"></div><div class="sheet menu" role="dialog" aria-label="Game menu"><button data-a="askundo" ${S.G!.turns.length ? '' : 'disabled'}>Undo last turn</button>${S.code ? `<p class="note" style="margin:0">Friends join with code <b>${S.code}</b> from the Join screen on this same page.</p>` : ''}<button data-a="leave">Leave game</button><button data-a="menu">Close</button></div>`;
  }
  const scroll: string[] = [];
  if (S.role === 'guest' && !hostPresent() && Date.now() - S.hostSeen > 10000 && S.canWrite !== false && S.db) {
    scroll.push("<div class=\"banner\"><span>The host's phone isn't connected. Turns entered here will wait until it comes back, or this phone can take over.</span><button data-a=\"takeover\">Host from this phone</button></div>");
  }
  scroll.push(board(st, cfg, pv));
  if (st.over) scroll.push(result(st, cfg));
  const recent = st.log.slice(-8).reverse();
  scroll.push(recent.length ? `<div><span class="eyebrow">Recent turns</span><div class="log" style="margin-top:6px">${recent.map((e: LogEntry) => `<div><span><b>${esc(cfg.players[e.p])}</b> · ${esc(e.txt)}</span><span>${esc(e.val)}</span></div>`).join('')}</div></div>` : '');
  return { top, scroll, panel: st.over ? [] : turnPanel(st, cfg, pv), sheet };
}

function board(st: GameState, cfg: GameConfig, pv: Preview): string {
  const g = cfg.game;
  const P = st.P;
  if (g === 'cricket') {
    const pp = (pv && pv.ps.P) || P;
    const dead = (n: number): boolean => P.every((p) => p.marks[n] >= 3);
    const curc = (p: PlayerState): string => (p.i === st.cur && !st.over ? 'curc' : '');
    return `<div class="cgrid"><table><thead><tr><th></th>${P.map((p) => `<th class="${curc(p)}" title="${esc(p.name)}">${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
    ${CR.map((n) => `<tr><th class="t ${dead(n) ? 'dead' : ''}">${n === 25 ? 'B' : n}</th>${pp.map((p) => `<td class="${curc(p)}">${MK[Math.min(3, p.marks[n])]}</td>`).join('')}</tr>`).join('')}
    <tr class="pts"><th class="t">Pts</th>${pp.map((p) => `<td class="${curc(p)}">${p.pts}</td>`).join('')}</tr></tbody></table></div>`;
  }
  return '<div class="board' + (P.length >= 4 ? ' compact' : '') + '">' + P.map((p) => {
    const cur = p.i === st.cur && !st.over;
    const cls = 'row' + (cur ? ' cur' : '') + (!p.alive ? ' out' : '');
    let score: string | number = '';
    let small = '';
    let extra = '';
    if (g === 'x01') {
      const rem = cur && pv ? pv.ps.P[p.i].rem : p.rem;
      score = rem;
      const avg = p.darts ? ((p.pts / p.darts) * 3).toFixed(1) : '–';
      small = `Avg ${avg}${p.last ? ' · last ' + p.last.val : ''}${p.t180 ? ' · 180s ×' + p.t180 : ''}${!p.opened ? ' · needs a double to start' : ''}`;
      if (cur && cfg.outRule === 'double' && p.opened) {
        const left = 3 - (S.tmode === 'darts' ? S.draft.length : 0);
        const busted = pv && pv.e.bust;
        const co = !busted && left > 0 ? checkout(rem, left) : null;
        if (co) extra = `<div class="hint"><em>Checkout</em>${co.map(dl).join(' · ')}</div>`;
      }
    } else if (g === 'atc') {
      const tp = cur && pv ? pv.ps.P[p.i].target : p.target;
      const idx = tp === 'done' ? 21 : tp === 25 ? 20 : tp - 1;
      score = tp === 'done' ? '✓' : tp === 25 ? 'B' : tp;
      small = 'Next target';
      extra = `<div class="prog">${Array.from({ length: 21 }, (_, i) => `<i class="${i < idx ? 'on' : ''}"></i>`).join('')}</div>`;
    } else if (g === 'killer') {
      const kp = cur && pv ? pv.ps.P : P;
      const me = kp[p.i];
      score = `<div class="lives">${Array.from({ length: cfg.lives ?? 3 }, (_, i) => `<i class="${i < me.lives ? '' : 'gone'}"></i>`).join('')}</div>`;
      small = `Number <span class="knum">${p.num}</span>${me.killer ? '<span class="tag">Killer</span>' : ''}${!me.alive ? ' · out' : ''}`;
      return `<div class="${cls}"><div class="who"><b>${esc(p.name)}</b><small>${small}</small></div><div>${score}</div></div>`;
    } else {
      score = cur && pv ? pv.ps.P[p.i].pts : p.pts;
      small = g === 'countup' ? `Best ${p.best}${p.last ? ' · last ' + p.last.val : ''}` : `${p.last ? 'Last ' + p.last.val : 'No throws yet'}`;
    }
    return `<div class="${cls}"><div class="who"><b>${esc(p.name)}</b><small>${small}</small></div><div class="score">${score}</div>${extra}</div>`;
  }).join('') + '</div>';
}

/** Common X01 visits, one tap each in turn-total mode. */
const QUICK = [26, 41, 45, 60, 81, 100, 140, 180];

/** The keypad as parts, so pressing a key only redraws the parts it changes. */
function turnPanel(st: GameState, cfg: GameConfig, pv: Preview): string[] {
  const g = cfg.game;
  const p = st.P[st.cur];
  if (S.pending) {
    const hp = hostPresent();
    const what = S.pending.kind === 'turn' ? 'Sending turn' : S.pending.kind === 'undo' ? 'Asking host to undo' : 'Asking host for a rematch';
    return [`<div class="waiting"><span class="spin"></span><span>${what}…${!hp && Date.now() - S.pending.at > 4000 ? "<br><span class=\"note\">Waiting for the host's phone to reconnect. It will go through automatically.</span>" : ''}</span></div>`];
  }
  if (S.role === 'guest' && !S.nroom) return ["<p class=\"note\" style=\"margin:0\">This phone can watch the scores but can't send turns. Ask the host to enter yours.</p>"];
  const e = pv && pv.e;
  const locked = e && (e.bust || e.win);
  const total = totalMode();
  const hasModes = g === 'x01' || g === 'countup';
  const canUndo = S.G!.turns.length > 0 && (S.role !== 'guest' || !!S.nroom);
  let status = '';
  if (e && pv) {
    if (e.win) status = '<span class="win">Game shot</span>';
    else if (e.bust) status = '<span class="bust">Bust</span>';
    else if (g === 'x01') status = '<span>' + (total ? S.total || 0 : S.draft.reduce((a, d) => a + dv(d), 0)) + ' · leaves ' + pv.ps.P[p.i].rem + '</span>';
    else if (g === 'countup' || g === 'shanghai') status = '<span>+' + (pv.ps.P[p.i].pts - p.pts) + '</span>';
    else if (g === 'atc') { const t = pv.ps.P[p.i].target; status = '<span>Aim: ' + (t === 25 ? 'Bull' : t) + '</span>'; }
    else if (g === 'killer') status = p.killer ? '<span>Hit doubles of other numbers</span>' : '<span>Aim: D' + p.num + '</span>';
  }
  const parts = [`<div class="thrower"><b>${esc(p.name)} to throw</b>${status}</div>`];
  const modeBtn = hasModes ? `<button class="modebtn" data-a="tmode" data-v="${total ? 'darts' : 'total'}" ${canTotal() ? '' : 'disabled'} aria-label="${total ? 'Enter dart by dart' : 'Enter the turn total'}">${total ? 'Darts' : 'Total'}</button>` : '';
  /* ⌫ removes the last dart or digit; with nothing entered it offers to undo the previous turn. */
  const empty = total ? !S.total : !S.draft.length;
  const backBtn = `<button class="wide" data-a="back" data-fast ${empty && !canUndo ? 'disabled' : ''} aria-label="${empty ? 'Undo last turn' : total ? 'Delete digit' : 'Remove last dart'}">${empty ? 'Undo' : '⌫'}</button>`;
  if (total) {
    parts.push(`<div class="trow"><div class="tdisp" aria-live="polite">${S.total || '0'}</div>${modeBtn}</div>`);
    parts.push(g === 'x01' ? `<div class="quick">${QUICK.map((n) => `<button data-a="quick" data-v="${n}" data-fast>${n}</button>`).join('')}</div>` : '');
    parts.push(`<div class="tpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="tk" data-v="${n}" data-fast>${n}</button>`).join('')}<button data-a="tk" data-v="c" data-fast aria-label="Clear">C</button><button data-a="tk" data-v="0" data-fast>0</button>${backBtn}</div>`);
  } else {
    const hot = hotNums(st, cfg, p, pv);
    const off = locked || S.draft.length >= 3 ? 'disabled' : '';
    parts.push(`<div class="slots${hasModes ? ' withmode' : ''}">${[0, 1, 2].map((i) => { const d = S.draft[i]; return d ? `<div class="slot f t${d.m}">${dl(d)}</div>` : `<div class="slot">${i + 1}</div>`; }).join('')}${modeBtn}</div>`);
    parts.push(`<div class="mult">${([[1, 'Single'], [2, 'Double'], [3, 'Treble']] as const).map(([m, l]) => `<button data-a="mult" data-m="${m}" data-fast aria-pressed="${S.mult === m}">${l}</button>`).join('')}</div>`);
    /* Cricket only scores on 15–20 and the bull, so its keypad drops 1–14 (Miss covers everything else). */
    const keys = g === 'cricket' ? [15, 16, 17, 18, 19, 20] : NUMS.slice().reverse();
    parts.push(`<div class="pad${g === 'cricket' ? ' cr' : ''}">${keys.map((n) => `<button data-a="dart" data-n="${n}" data-fast class="${hot.has(n) ? 'hot' : ''}" ${off}>${n}</button>`).join('')}</div>`);
    parts.push(`<div class="pad5"><button class="wide bull ${hot.has(25) ? 'hot' : ''}" data-a="dart" data-n="25" data-mm="1" data-fast ${off}>25</button><button class="wide bull ${hot.has(25) ? 'hot' : ''}" data-a="dart" data-n="25" data-mm="2" data-fast ${off}>Bull</button><button class="wide" data-a="dart" data-n="0" data-fast ${off}>Miss</button>${backBtn}</div>`);
  }
  const n = S.draft.length;
  let label = 'Enter turn';
  let ec = '';
  if (e && e.win) { label = 'Confirm game shot'; ec = 'win'; }
  else if (e && e.bust) { label = 'Confirm bust'; ec = 'bust'; }
  else if (!total && n < 3) label = n === 0 ? 'No score' : 'Enter turn (' + (3 - n) + ' missed)';
  else if (n === 3 && !total) ec = 'ready';
  parts.push(`<button class="enter ${ec}" data-a="submit">${label}</button>`);
  return parts;
}

/** Numbers worth aiming at right now, outlined on the keypad. */
function hotNums(st: GameState, cfg: GameConfig, p: PlayerState, pv: Preview): Set<number> {
  const g = cfg.game;
  const s = new Set<number>();
  if (g === 'cricket') CR.forEach((n) => { if (!st.P.every((o) => o.marks[n] >= 3)) s.add(n); });
  else if (g === 'atc') { const t = pv ? pv.ps.P[p.i].target : p.target; if (t !== 'done') s.add(t); }
  else if (g === 'shanghai') s.add(st.round);
  else if (g === 'killer') { if (p.killer) st.P.forEach((o) => { if (o !== p && o.alive) s.add(o.num); }); else s.add(p.num); }
  else if (g === 'x01' && cfg.outRule === 'double') {
    const left = 3 - S.draft.length;
    const rem = pv ? pv.ps.P[p.i].rem : p.rem;
    const co = left > 0 && !(pv && pv.e.bust) ? checkout(rem, left) : null;
    if (co) s.add(co[0].n);
  }
  return s;
}

function result(st: GameState, cfg: GameConfig): string {
  const g = cfg.game;
  const names = st.winners.map((i) => cfg.players[i]);
  const head = names.length > 1 ? 'Draw' : esc(names[0] || '');
  let cols: string[];
  let rows: (string | number)[][];
  if (g === 'x01') { cols = ['Avg', 'Best', '180s', 'Darts']; rows = st.P.map((p) => [p.darts ? ((p.pts / p.darts) * 3).toFixed(1) : '–', p.best, p.t180, p.darts]); }
  else if (g === 'cricket') { cols = ['Points', 'Marks']; rows = st.P.map((p) => [p.pts, CR.reduce((a, n) => a + p.marks[n], 0)]); }
  else if (g === 'atc') { cols = ['Reached', 'Darts']; rows = st.P.map((p) => [p.target === 'done' ? 'Finished' : p.target === 25 ? 'Bull' : p.target, p.darts]); }
  else if (g === 'killer') { cols = ['Number', 'Lives']; rows = st.P.map((p) => [p.num, p.lives]); }
  else { cols = ['Points', 'Best turn']; rows = st.P.map((p) => [p.pts, p.best]); }
  const canRe = S.role !== 'guest' || !!S.nroom;
  return `<div class="panel result"><span class="eyebrow">${names.length > 1 ? 'Tied: ' + esc(names.join(' & ')) : 'Winner'}</span><div class="w">${head}</div>
  <table class="stats"><thead><tr><th>Player</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${st.P.map((p, i) => `<tr><td>${esc(p.name)}</td>${rows[i].map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <div class="confirm"><div class="btns"><button data-a="askundo">Undo last turn</button>${canRe ? '<button class="danger" data-a="rematch">Rematch</button>' : ''}</div><button class="ghost" data-a="leave">New game</button></div></div>`;
}
