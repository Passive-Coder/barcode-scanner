import { decode } from "./decoder.js";
import { createScan, readPixels } from "./scan.js";

/** Photos larger than this are scaled down first; it keeps decoding fast without losing small codes. */
const MAX_IMAGE_EDGE = 2600;

/** Uploads get the most thorough settings, since speed matters less than for live video. */
/** @type {import("zxing-wasm/reader").ReaderOptions} */
const IMAGE_OPTIONS = { tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, tryDenoise: true, maxNumberOfSymbols: 16 };

/**
 * Decodes every barcode in an image file. The browser decodes the image itself, so any format
 * it can display works (including WebP, and HEIC on Safari) and EXIF rotation is respected.
 * @param {File} file
 */
export async function scanImageFile(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image couldn't be opened. Try a JPG or PNG.");
  }
  let pixels;
  try {
    pixels = readPixels(bitmap, bitmap.width, bitmap.height, MAX_IMAGE_EDGE);
  } finally {
    bitmap.close();
  }
  const barcodes = await decode(pixels, IMAGE_OPTIONS);
  return barcodes.map((barcode) => createScan(barcode, { origin: "image", source: file.name }));
}
