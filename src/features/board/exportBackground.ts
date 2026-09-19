import { solidHex } from "../../domain/colors";
import { useBoardStore } from "../../store/boardStore";
import { loadImage } from "../../store/imageStore";

/**
 * Putting the board's background into an exported picture.
 *
 * Exports capture the lists' rail, and the background is drawn on a layer
 * *behind* the rail (see `BoardBackdrop`), so it is not in the capture unless
 * it is added back. Read straight from the store: this runs from a click
 * handler, not during render.
 */

/** Paints the board's background across the whole of `context`'s canvas, and
    says whether there was one to paint. */
async function paintBackdrop(context: CanvasRenderingContext2D): Promise<boolean> {
  const background = useBoardStore.getState().background;
  const { width, height } = context.canvas;
  if (background === undefined) {
    return false;
  }

  if (background.kind === "color") {
    context.fillStyle = solidHex(background.color);
    context.fillRect(0, 0, width, height);
    return true;
  }

  const blob = await loadImage(background.imageId);
  if (!blob) {
    return false;
  }
  const bitmap = await createImageBitmap(blob);
  // `cover`: scale until both sides are filled, centre, let the excess fall off.
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const scaledWidth = bitmap.width * scale;
  const scaledHeight = bitmap.height * scale;
  context.drawImage(bitmap, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight);
  bitmap.close();

  // The on-screen wash is `--surface-app` at `wash` opacity; read the same
  // token so an export matches the theme it was made in.
  context.globalAlpha = background.wash;
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface-app").trim();
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  return true;
}

/**
 * `captured` (the rail, with transparent gaps between the lists) laid over
 * the board's background: a fill for a colour; for an image, the picture
 * cropped to cover the whole export the way the screen does, then the theme's
 * page colour at the chosen dimming.
 *
 * A board with no background, or whose image has gone missing, shows the
 * theme's default on screen; `fallbackColor` is what an export should show
 * there. Left out, the gaps stay transparent (a copy for pasting) and
 * `captured` is returned as it is.
 */
export async function withBackdrop(
  captured: HTMLCanvasElement,
  fallbackColor?: string,
): Promise<HTMLCanvasElement> {
  const result = document.createElement("canvas");
  result.width = captured.width;
  result.height = captured.height;
  const context = result.getContext("2d");
  if (!context) {
    return captured;
  }

  if (!(await paintBackdrop(context))) {
    if (fallbackColor === undefined) {
      return captured;
    }
    context.fillStyle = fallbackColor;
    context.fillRect(0, 0, result.width, result.height);
  }
  context.drawImage(captured, 0, 0);
  return result;
}
