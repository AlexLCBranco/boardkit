import type { CardId } from "../../domain/types";
import { cardElement } from "../shortcuts/dom";

/**
 * Scrolls a card into view and flashes it. Works off the DOM, like the
 * shortcut code does: every card already carries `data-card-id`, so no ref
 * needs threading down from the search dialog.
 *
 * The flash is a CSS animation on a pseudo-element, switched on by the
 * `data-found` attribute (see `CardItem.module.css`). The card's own React
 * props never mention it, so React leaves the attribute alone; it is removed
 * again when the animation ends so the same card can be found twice.
 */

/** After switching boards the new columns render on a later frame, so the
    card may not exist yet. About a second of frames is far more than React
    needs; giving up quietly beats an error for a card that is gone. */
const MAX_FRAMES_TO_WAIT = 60;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function revealCard(cardId: CardId, framesLeft = MAX_FRAMES_TO_WAIT): void {
  const card = cardElement(cardId);
  if (!card) {
    if (framesLeft > 0) requestAnimationFrame(() => revealCard(cardId, framesLeft - 1));
    return;
  }

  card.scrollIntoView({
    block: "center",
    inline: "center",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  // Removing then re-adding needs a reflow in between, or the browser sees
  // no change and does not restart the animation.
  card.removeAttribute("data-found");
  void card.offsetWidth;
  card.setAttribute("data-found", "");
  // Other animations (a thots section opening) bubble up to the card too, so
  // only the flash's own -- on the card's `::after` -- counts.
  card.addEventListener("animationend", function done(event) {
    if (event.target !== card || event.pseudoElement !== "::after") return;
    card.removeAttribute("data-found");
    card.removeEventListener("animationend", done);
  });
}
