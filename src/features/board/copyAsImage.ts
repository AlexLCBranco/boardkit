import { toBlob } from "html-to-image";

/**
 * Browsers cap canvas size (Chrome: 16384px on a side), and a blank or
 * failed export is the result of exceeding it -- so a wide export lowers its
 * own pixel density rather than fail.
 */
const MAX_CANVAS_SIDE = 16000;

interface CopyAsImageOptions {
  /** Preferred pixel density; lowered automatically if the node is huge. */
  readonly pixelRatio: number;
  /** Renders the clone at this CSS zoom, e.g. `1` to ignore a zoomed ancestor's view. */
  readonly zoom?: number;
}

/**
 * Rasterises `node` and puts the PNG on the clipboard.
 *
 * Every element tagged `data-capture-exclude="true"` -- buttons, resize
 * handles, composers -- is skipped, so the image is the content only, not its
 * interactive chrome. Throws on failure; callers own the user-facing state.
 */
export async function copyAsImage(node: HTMLElement, options: CopyAsImageOptions): Promise<void> {
  const largestSide = Math.max(node.scrollWidth, node.scrollHeight);
  const pixelRatio = Math.min(options.pixelRatio, MAX_CANVAS_SIDE / largestSide);

  const blob = await toBlob(node, {
    pixelRatio,
    filter: (child) => !(child instanceof HTMLElement && child.dataset.captureExclude === "true"),
    ...(options.zoom !== undefined ? { style: { zoom: String(options.zoom) } } : {}),
  });
  if (!blob) {
    throw new Error("toBlob returned null");
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
