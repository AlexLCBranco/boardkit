import { solidHex } from "../../domain/colors";
import { useBoardStore } from "../../store/boardStore";

/**
 * The board's background colour as CSS, for filling behind an exported image,
 * or `undefined` when the board has none.
 *
 * Exports capture the lists' rail, and the background is drawn on a layer
 * *behind* the rail (see `BoardBackdrop`), so it is not in the capture unless
 * it is added back. Read straight from the store: this runs from a click
 * handler, not during render.
 */
export function exportBackgroundColor(): string | undefined {
  const background = useBoardStore.getState().background;
  return background?.kind === "color" ? solidHex(background.color) : undefined;
}
