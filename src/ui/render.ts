import { S } from '../app/state';
import { $ } from '../app/util';
import { vGame, vHome, vJoin, vLoading, vSetup } from './views';

/* Rendering only touches what changed: each region keeps the HTML it last drew and is left alone if unchanged.
   Buttons under a finger survive a redraw, so press states, focus and scroll positions stay put. */
type Region = HTMLElement & { _h?: string | null };

function patch(el: Region, html: string): boolean {
  if (el._h !== html) { el.innerHTML = html; el._h = html; return true; }
  return false;
}

function patchParts(el: HTMLElement, parts: string[]): void {
  if (el.childElementCount !== parts.length) el.innerHTML = parts.map(() => '<div class="part"></div>').join('');
  parts.forEach((h, i) => patch(el.children[i] as Region, h));
}

let lastCur: string | null = null;

export function renderApp(): void {
  const a = $('#app') as Region;
  if (!(S.view === 'game' && S.G && S.st)) {
    if (a.dataset.mode !== 'page') { a.dataset.mode = 'page'; a.className = ''; a._h = null; }
    patch(a, S.view === 'home' ? vHome() : S.view === 'setup' ? vSetup() : S.view === 'join' ? vJoin() : vLoading());
    return;
  }
  if (a.dataset.mode !== 'game') {
    a.dataset.mode = 'game'; a.className = 'game'; a._h = null; lastCur = null;
    a.innerHTML = '<div class="gtop"></div><div class="gmain"><div class="gscroll"></div><div class="turnpanel"></div></div><div class="gsheet"></div>';
  }
  const v = vGame();
  patchParts(a.querySelector('.gtop')!, v.top);
  const sc = a.querySelector<HTMLElement>('.gscroll')!;
  patchParts(sc, v.scroll);
  const tp = a.querySelector<HTMLElement>('.turnpanel')!;
  tp.hidden = !v.panel.length;
  patchParts(tp, v.panel);
  const sh = a.querySelector<Region>('.gsheet')!;
  sh.hidden = !v.sheet;
  patch(sh, v.sheet);
  /* Keep whoever is throwing in view when the board is taller than its space. */
  const cur = S.st.over ? null : S.G.turns.length + ':' + S.st.cur;
  if (cur !== lastCur) {
    lastCur = cur;
    sc.querySelector('.row.cur,.curc')?.scrollIntoView({ block: 'nearest' });
  }
}
