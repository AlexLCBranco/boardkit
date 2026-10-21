/**
 * This page's own writes to Boardkit's keys (a board, the board list). The
 * browser's `storage` event tells only the OTHER tabs of a write; on the
 * gauntlet whiteboard Boardkit's boards and Linkkit's maps share one page,
 * so Linkkit beside Boardkit (a map linked to a board) hears of this
 * page's writes here (`app/whiteboard/`). Told once per key per task,
 * after the write.
 */
type Listener = (key: string) => void;

const listeners = new Set<Listener>();
let waiting: Set<string> | null = null;

export function wroteHere(key: string): void {
  if (waiting) {
    waiting.add(key);
    return;
  }
  waiting = new Set([key]);
  queueMicrotask(() => {
    const keys = waiting ?? new Set<string>();
    waiting = null;
    for (const k of keys) for (const listener of [...listeners]) listener(k);
  });
}

/** Returns a stop function. */
export function onWroteHere(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
