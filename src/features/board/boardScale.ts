/**
 * How much a board is scaled on screen, for code that turns screen
 * distances (pointer moves, measured rects) into the board's own pixels.
 *
 * Always 1 in Boardkit itself. On the gauntlet whiteboard a board sits
 * inside the whiteboard's zoom and its own scale (CSS transforms), marked
 * `data-boardkit-board` (`app/whiteboard/`): there it is the ratio of the
 * board's drawn width to its own.
 */
export function boardScale(element: Element | null | undefined): number {
  const root = element?.closest<HTMLElement>("[data-boardkit-board]");
  if (!root || root.offsetWidth === 0) return 1;
  const scale = root.getBoundingClientRect().width / root.offsetWidth;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
