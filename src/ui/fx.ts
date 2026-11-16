import { S } from '../app/state';
import { $, esc } from '../app/util';

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** A short message at the top of the screen. */
export function showToast(msg: string): void {
  clearTimeout(toastTimer);
  const fx = $('#fx')!;
  let el = fx.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    fx.appendChild(el);
  }
  el.textContent = msg;
  const shown = el;
  toastTimer = setTimeout(() => shown.remove(), 2600);
}

/** Browsers refuse (and log an error for) vibration before the person has tapped the page. */
const canVibrate = (): boolean => 'vibrate' in navigator && (navigator.userActivation?.hasBeenActive ?? true);

const BIG: Record<string, [string, string]> = {
  '180': ['One<br>Hundred<br>and Eighty', ''],
  win: ['Game shot', ''],
  shanghai: ['Shanghai!', ''],
  killer: ['Killer', ''],
  out: ['Knocked out', 'r'],
  bust: ['Bust', 'r'],
};

/** Big on-screen moment (and a buzz) for the turn just entered: 180, game shot, bust... */
export function celebrate(): void {
  const e = S.st && S.st.log[S.st.log.length - 1];
  if (!e || !e.fx || !S.G) return;
  const name = S.G.cfg.players[e.p];
  const [big, cls] = BIG[e.fx];
  const w = document.createElement('div');
  w.className = 'celebrate';
  w.setAttribute('aria-live', 'polite');
  w.innerHTML = '<div class="' + cls + '">' + big + '<small>' + esc(name) + '</small></div>';
  $('#fx')!.appendChild(w);
  setTimeout(() => w.remove(), 1700);
  try { if (canVibrate()) navigator.vibrate(e.fx === 'bust' ? [80, 60, 80] : [40, 40, 120]); } catch { /* not supported */ }
}

/** A light tick when a keypad key is pressed (Android). */
export function buzz(): void {
  try { if (canVibrate()) navigator.vibrate(6); } catch { /* not supported */ }
}
