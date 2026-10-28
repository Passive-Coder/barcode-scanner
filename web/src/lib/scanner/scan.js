/**
 * Builds the app's scan record from a decoded barcode.
 * @param {import("./decoder.js").DecodedBarcode} barcode
 * @param {{ origin: "camera" | "image", source: string }} context
 * @returns {import("../barcode/fields.js").RawScan}
 */
export function createScan(barcode, { origin, source }) {
  return {
    id: crypto.randomUUID(),
    text: barcode.text,
    format: barcode.format || "Unknown format",
    bytes: barcode.bytes,
    angle: Number.isFinite(barcode.orientation) ? barcode.orientation : null,
    origin,
    source,
    time: new Date(),
  };
}

/**
 * Draws an image source (or the `crop` part of it) into a canvas, scaled down to `maxEdge`, and
 * returns its pixels.
 * @param {CanvasImageSource & { width: number, height: number }} source
 * @param {number} width @param {number} height
 * @param {number} maxEdge
 * @param {{ canvas?: OffscreenCanvas | HTMLCanvasElement }} [reuse] pass a canvas to reuse between frames
 * @param {{ x: number, y: number, width: number, height: number }} [crop] in the source's pixels
 */
export function readPixels(source, width, height, maxEdge, reuse = {}, crop = { x: 0, y: 0, width, height }) {
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  const w = Math.max(1, Math.round(crop.width * scale));
  const h = Math.max(1, Math.round(crop.height * scale));
  reuse.canvas ??= typeof OffscreenCanvas === "function" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  const canvas = reuse.canvas;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const context = /** @type {CanvasRenderingContext2D | null} */ (canvas.getContext("2d", { willReadFrequently: true }));
  if (!context) throw new Error("This browser cannot read image pixels.");
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

/**
 * Maps camera and decoder failures to guidance a person can act on.
 * @param {unknown} error
 */
export function describeScannerError(error) {
  const name = /** @type {any} */ (error)?.name ?? "";
  const message = String(/** @type {any} */ (error)?.message ?? error ?? "");
  if (name === "NotAllowedError" || name === "SecurityError" || /Permission denied/i.test(message)) {
    return "Camera access was denied. Allow it in your browser's site settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || /Requested device not found/i.test(message)) {
    return "No camera was found. Try image upload instead.";
  }
  if (name === "NotReadableError" || /Could not start video source/i.test(message)) {
    return "The camera is in use by another app or tab. Close it and try again.";
  }
  return message || "The scanner stopped unexpectedly. Please try again.";
}
