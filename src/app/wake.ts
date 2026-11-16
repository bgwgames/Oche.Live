/** Keeps the screen on during a game, where the browser allows it. */
let lock: WakeLockSentinel | null = null;

export async function wake(): Promise<void> {
  try {
    if ('wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    }
  } catch { /* not allowed or not supported */ }
}
