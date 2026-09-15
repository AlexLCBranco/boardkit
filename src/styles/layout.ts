/**
 * JS-side mirror of the list-width bounds in `tokens.css`.
 *
 * Same reasoning as `motion.ts`'s mirrors: the resize handle clamps a
 * `clientX` delta on every pointer move, which needs a plain number, not a
 * `var(...)` reference. Keep these in sync with tokens.css by hand.
 */
export const LIST_WIDTH_MIN = 220;
export const LIST_WIDTH_MAX = 640;
