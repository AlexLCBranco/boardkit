import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onAway` when a press lands anywhere outside `ref`'s element while
 * `active`: a click away from a field being typed in saves it, as Enter
 * does (owner, 2026-10-21). Seen first (window, capture), before anything
 * else reacts to the press, so the text is kept even when that press ends
 * the editing around the field (the gauntlet whiteboard ends a board's
 * editing on a press outside it, and the field is gone before it could
 * blur), or keeps the focus where it is (the press never blurs the field).
 * The press itself then goes on to do whatever it does.
 */
export function useClickAway(ref: RefObject<HTMLElement | null>, active: boolean, onAway: () => void): void {
  const latest = useRef(onAway);
  latest.current = onAway;
  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      latest.current();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [ref, active]);
}
