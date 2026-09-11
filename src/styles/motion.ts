/**
 * JS-side mirrors of the motion tokens in `tokens.css`.
 *
 * They exist for the one place a CSS custom property can't reach: dnd-kit's
 * `useSortable({ transition })` option, which needs a plain number and
 * string, not a `var(...)` reference. Keep these in sync with tokens.css by
 * hand -- there is no build step that shares them automatically.
 */
export const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/**
 * The settle/reflow transition every sortable item (card or list) uses once
 * dnd-kit repositions it -- on drop, and as siblings make room during a
 * drag. A slight spring overshoot reads as a physical landing, which a
 * lift-off should not have (see `CardItem.module.css`'s `.overlay`, which
 * uses `--ease-out` instead).
 */
export const sortableTransition = {
  duration: 220,
  easing: EASE_SPRING,
};
