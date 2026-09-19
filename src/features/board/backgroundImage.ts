import { parseHex } from "../../domain/colors";
import type { HexColor } from "../../domain/types";

/**
 * Turns a picture the user chose into something worth keeping: shrunk and
 * re-encoded, so a 10 MB phone photo is stored as a few hundred KB, plus its
 * average colour. Uses the browser's canvas, which is why it lives here and
 * not in `domain/`.
 */

/** Longest side kept. A board background is seen at screen size at most, so
    2560px covers a large monitor; anything bigger is wasted storage. */
const MAX_SIDE = 2560;
const QUALITY = 0.8;
/** The average is taken from an image this many pixels square: cheap, and
    the canvas's own smoothing does the averaging. */
const SAMPLE_SIDE = 16;

export interface PreparedImage {
  readonly blob: Blob;
  readonly average: HexColor;
}

/** A problem worth telling the user, in words they can act on. */
export class ImageRejected extends Error {}

function newCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new ImageRejected("This browser can't process images.");
  }
  return [canvas, context];
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

function averageColor(bitmap: ImageBitmap): HexColor {
  const [canvas, context] = newCanvas(SAMPLE_SIDE, SAMPLE_SIDE);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, SAMPLE_SIDE, SAMPLE_SIDE);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const sums = [0, 0, 0];
  const pixels = data.length / 4;
  for (let index = 0; index < data.length; index += 4) {
    sums[0] += data[index];
    sums[1] += data[index + 1];
    sums[2] += data[index + 2];
  }
  const hex = sums.map((sum) => Math.round(sum / pixels).toString(16).padStart(2, "0")).join("");
  return parseHex(hex) as HexColor;
}

/**
 * Resizes to at most `MAX_SIDE` on the long edge (never enlarging) and
 * re-encodes as WebP, falling back to JPEG where the browser cannot encode
 * WebP (it silently hands back a PNG instead, which would be huge).
 * Rejects with an `ImageRejected` for a file that is not a readable image.
 */
export async function prepareBackgroundImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImageRejected("That file isn't an image.");
  }
  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the photo's rotation, so a portrait phone shot is not sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageRejected("That image couldn't be read.");
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const [canvas, context] = newCanvas(width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    let blob = await encode(canvas, "image/webp");
    if (blob?.type !== "image/webp") {
      // JPEG has no transparency; without a base a see-through PNG turns black.
      const [flat, flatContext] = newCanvas(width, height);
      flatContext.fillStyle = "#ffffff";
      flatContext.fillRect(0, 0, width, height);
      flatContext.drawImage(canvas, 0, 0);
      blob = await encode(flat, "image/jpeg");
    }
    if (!blob) {
      throw new ImageRejected("That image couldn't be processed.");
    }
    return { blob, average: averageColor(bitmap) };
  } finally {
    bitmap.close();
  }
}
