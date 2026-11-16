/** Small helpers with no app state. */

/** localStorage that never throws (private mode, blocked storage) and returns null when empty. */
export const ls = {
  get<T = unknown>(k: string): T | null {
    try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null; } catch { return null; }
  },
  set(k: string, v: unknown): void {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
  },
  del(k: string): void {
    try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
  },
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapes text for HTML. Use on every value that came from a person or another phone. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = <T extends Element = HTMLElement>(s: string): T | null => document.querySelector<T>(s);
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
