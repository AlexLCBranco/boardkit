import { canvasToBlob, renderToCanvas } from "./copyAsImage";
import { withBackdrop } from "./exportBackground";
import { jpegToPdf } from "./imagePdf";

/**
 * Saves the whole board -- every list, not just what the scroller shows -- as
 * a file on disk. The rail is captured at zoom 1 so the file does not depend
 * on the current zoom level, the same way `CopyBoardButton` does it.
 */

// Lower than the clipboard's 4x: a file is kept and sent around, and a wide
// board at 4x would be tens of megabytes for no visible gain.
const PIXEL_RATIO = 2;
const JPEG_QUALITY = 0.92;

/** The first opaque background at or above `node`: what shows behind a board
    with no background of its own. The rail itself is transparent, and a JPEG
    would otherwise render that as black. */
function backgroundBehind(node: HTMLElement): string {
  for (let el: HTMLElement | null = node; el; el = el.parentElement) {
    const color = getComputedStyle(el).backgroundColor;
    if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
      return color;
    }
  }
  return "#fff";
}

function fileName(boardName: string, extension: string): string {
  const slug = boardName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "board"}.${extension}`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** The whole rail, over the board's background (or the page's, if it has none). */
async function renderBoard(rail: HTMLElement): Promise<HTMLCanvasElement> {
  const canvas = await renderToCanvas(rail, { pixelRatio: PIXEL_RATIO, zoom: 1 });
  return withBackdrop(canvas, backgroundBehind(rail));
}

export async function saveBoardAsPng(rail: HTMLElement, boardName: string): Promise<void> {
  const canvas = await renderBoard(rail);
  download(await canvasToBlob(canvas, "image/png"), fileName(boardName, "png"));
}

export async function saveBoardAsPdf(rail: HTMLElement, boardName: string): Promise<void> {
  const canvas = await renderBoard(rail);
  const jpeg = new Uint8Array(await (await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY)).arrayBuffer());
  // Page size is the board's on-screen size (1 CSS px = 1 pt), not the pixel
  // size, so the PDF opens at a sensible zoom and the extra pixels sharpen it.
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, canvas.width / PIXEL_RATIO, canvas.height / PIXEL_RATIO);
  download(pdf, fileName(boardName, "pdf"));
}
