import { toCanvas } from "html-to-image";

/**
 * Browsers cap canvas size (Chrome: 16384px on a side), and a blank or
 * failed export is the result of exceeding it -- so a wide export lowers its
 * own pixel density rather than fail.
 */
const MAX_CANVAS_SIDE = 16000;

export interface RenderOptions {
  /** Preferred pixel density; lowered automatically if the node is huge. */
  readonly pixelRatio: number;
  /** Renders the clone at this CSS zoom, e.g. `1` to ignore a zoomed ancestor's view. */
  readonly zoom?: number;
  /** Fills the background, for formats (JPEG) that have no transparency. */
  readonly backgroundColor?: string;
}

/**
 * Rasterises `node` onto a canvas.
 *
 * Every element tagged `data-capture-exclude="true"` -- buttons, resize
 * handles, composers -- is skipped, so the image is the content only, not its
 * interactive chrome. Throws on failure; callers own the user-facing state.
 */
export function renderToCanvas(node: HTMLElement, options: RenderOptions): Promise<HTMLCanvasElement> {
  const largestSide = Math.max(node.scrollWidth, node.scrollHeight);
  const pixelRatio = Math.min(options.pixelRatio, MAX_CANVAS_SIDE / largestSide);

  return toCanvas(node, {
    pixelRatio,
    filter: (child) => !(child instanceof HTMLElement && child.dataset.captureExclude === "true"),
    ...(options.zoom !== undefined ? { style: { zoom: String(options.zoom) } } : {}),
    ...(options.backgroundColor !== undefined ? { backgroundColor: options.backgroundColor } : {}),
  });
}

/** Rasterises `node` and puts the PNG on the clipboard. */
export async function copyAsImage(node: HTMLElement, options: RenderOptions): Promise<void> {
  const canvas = await renderToCanvas(node, options);
  const blob = await canvasToBlob(canvas, "image/png");
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      type,
      quality,
    );
  });
}
