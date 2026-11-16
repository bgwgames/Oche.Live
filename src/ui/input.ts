import { defaultSetup, type Setup } from '../engine';
import { S, render, syncOK } from '../app/state';
import { $, ls } from '../app/util';
import { addDigit, doBack, doRematch, enterDart, submitTurn, totalMode, undoLast } from '../app/actions';
import { joinGame, leave, startGame, takeOver } from '../app/session';
import { wake } from '../app/wake';
import { buzz } from './fx';

function newSetup(): Setup {
  return defaultSetup(ls.get<string[]>('oche.names') ?? [], syncOK());
}

/** Runs the action named by a button's data-a attribute. */
function act(b: HTMLElement): void {
  const a = b.dataset.a;
  const su = S.setup;
  if (a === 'new') { S.setup = newSetup(); S.loadErr = ''; S.view = 'setup'; }
  else if (a === 'join') { S.view = 'join'; S.joinErr = ''; setTimeout(() => $<HTMLInputElement>('#code')?.focus(), 50); }
  else if (a === 'home') S.view = 'home';
  else if (a === 'game' && su) su.game = b.dataset.v as Setup['game'];
  else if (a === 'opt' && su) {
    const k = b.dataset.k as keyof Setup;
    const v = b.dataset.v ?? '';
    (su as unknown as Record<string, unknown>)[k] = k === 'cut' ? v === 'true' : /^\d+$/.test(v) ? parseInt(v, 10) : v;
  }
  else if (a === 'add' && su) {
    su.players.push('Player ' + (su.players.length + 1));
    render();
    const i = $<HTMLInputElement>('#pn' + (su.players.length - 1));
    if (i) { i.focus(); i.select(); }
    return;
  }
  else if (a === 'rm' && su) su.players.splice(Number(b.dataset.i), 1);
  else if (a === 'share' && su) su.share = !su.share;
  else if (a === 'start') { void startGame(); return; }
  else if (a === 'dojoin') { joinGame(); return; }
  else if (a === 'mult') { const m = Number(b.dataset.m); S.mult = S.mult === m ? 1 : m; }
  else if (a === 'dart') enterDart(Number(b.dataset.n), b.dataset.mm ? Number(b.dataset.mm) : 0);
  else if (a === 'back') doBack();
  else if (a === 'tmode' && S.G) {
    S.tmode = b.dataset.v === 'total' ? 'total' : 'darts'; S.draft = []; S.total = '';
    const m = ls.get<Record<string, string>>('oche.tmode') ?? {};
    m[S.G.cfg.game] = S.tmode;
    ls.set('oche.tmode', m);
  }
  else if (a === 'tk') { const v = b.dataset.v ?? ''; if (v === 'c') S.total = ''; else addDigit(v); }
  else if (a === 'quick') S.total = b.dataset.v ?? '';
  else if (a === 'submit') { submitTurn(); return; }
  else if (a === 'menu') S.menu = !S.menu;
  else if (a === 'askundo') { S.menu = false; S.confirmUndo = true; }
  else if (a === 'noundo') S.confirmUndo = false;
  else if (a === 'doundo') { undoLast(); return; }
  else if (a === 'rematch') { doRematch(true); return; }
  else if (a === 'leave') { leave(); return; }
  else if (a === 'takeover') { takeOver(false); return; }
  render();
}

/* Keyboard scoring for tablets and laptops. Darts: type the number (1, 19, 25), S/D/T for the multiplier,
   B for bull, M or 0 for a miss. Totals: type the score. Enter submits, Backspace removes, Esc closes. */
let kbBuf = '';
let kbTimer: ReturnType<typeof setTimeout> | undefined;
function kbFlush(): void {
  clearTimeout(kbTimer);
  if (!kbBuf) return;
  const n = Number(kbBuf);
  kbBuf = '';
  if ((n >= 1 && n <= 20) || n === 25) enterDart(n);
  render();
}

function onKey(ev: KeyboardEvent): void {
  const target = ev.target as HTMLElement;
  if (ev.key === 'Enter' && target.id === 'code') { ev.preventDefault(); joinGame(); return; }
  if (S.view !== 'game' || !S.G || !S.st || ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input,textarea,select')) return;
  const k = ev.key;
  if (k === 'Escape') { if (S.confirmUndo || S.menu) { S.confirmUndo = false; S.menu = false; render(); } return; }
  if (S.confirmUndo) { if (k === 'Enter' && !target.closest('button')) { ev.preventDefault(); undoLast(); } return; }
  if (S.menu || S.st.over || S.pending) return;
  if (k === 'Enter') { if (target.closest('button')) return; ev.preventDefault(); kbFlush(); submitTurn(); return; }
  if (k === 'Backspace') { ev.preventDefault(); if (kbBuf) { kbBuf = ''; clearTimeout(kbTimer); } else doBack(); render(); return; }
  if (totalMode()) {
    if (/^\d$/.test(k)) addDigit(k);
    else if (k === 'Delete' || k.toLowerCase() === 'c') S.total = '';
    else return;
    ev.preventDefault(); render(); return;
  }
  const lk = k.toLowerCase();
  if (lk === 's' || lk === 'd' || lk === 't') { S.mult = { s: 1, d: 2, t: 3 }[lk]; render(); return; }
  if (lk === 'm' || (k === '0' && !kbBuf)) { enterDart(0); render(); return; }
  if (lk === 'b') { kbFlush(); enterDart(25); render(); return; }
  if (/^\d$/.test(k)) {
    kbBuf += k;
    clearTimeout(kbTimer);
    /* 3–9 can't start a valid two-digit number, so enter it at once; 1 and 2 wait briefly for a second digit. */
    if (kbBuf.length >= 2 || Number(kbBuf) >= 3) kbFlush();
    else kbTimer = setTimeout(kbFlush, 600);
  }
}

export function installInput(): void {
  /* Keypad keys (data-fast) act on touch-down instead of on release, which removes the lag of a full tap.
     The click that follows a pointer press is then ignored; keyboard-activated clicks (detail 0) still work. */
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-fast]');
    if (!b || b.disabled) return;
    buzz(); act(b);
  });
  document.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-a]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-fast') && ev.detail > 0) return;
    act(b);
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'code') { t.value = t.value.toUpperCase().replace(/[^A-Z]/g, ''); S.joinCode = t.value; }
    else if (t.dataset.i != null && S.setup) S.setup.players[Number(t.dataset.i)] = t.value;
  });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.view === 'game') void wake(); });
  /* Guests and pending requests show time-based hints ("host offline"), so refresh them now and then. */
  setInterval(() => { if (S.view === 'game' && (S.pending || S.role === 'guest')) render(); }, 3000);
}
