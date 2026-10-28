/**
 * The browser's built-in barcode detector (Chrome on Android, ChromeOS, and macOS), which uses
 * the device's own vision service and reads a frame in a few milliseconds, far faster than
 * WebAssembly. Where it's missing or knows no formats, zxing-wasm does all the work.
 *
 * @typedef {import("./decoder.js").DecodedBarcode} DecodedBarcode
 * @typedef {{ formats: string[], detect: (source: ImageBitmapSource) => Promise<DecodedBarcode[]> }} NativeDetector
 */

/** The detector's format names, as zxing-wasm labels them, so scans look the same either way. */
const LABELS = /** @type {Record<string, string>} */ ({
  qr_code: "QR Code",
  ean_13: "EAN-13",
  ean_8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  code_128: "Code 128",
  code_39: "Code 39",
  code_93: "Code 93",
  codabar: "Codabar",
  itf: "ITF",
  data_matrix: "Data Matrix",
  pdf417: "PDF417",
  aztec: "Aztec",
});

/** UTF-8 length of a string. @param {string} text */
const byteLength = (text) => new TextEncoder().encode(text).length;

/** @returns {Promise<NativeDetector | null>} */
export async function createNativeDetector() {
  const Detector = /** @type {any} */ (globalThis).BarcodeDetector;
  if (typeof Detector !== "function") return null;
  try {
    /** @type {string[]} */
    const supported = await Detector.getSupportedFormats();
    const formats = supported.filter((format) => format in LABELS);
    if (!formats.length) return null;
    const detector = new Detector({ formats });
    return {
      formats,
      async detect(source) {
        /** @type {Array<{ rawValue: string, format: string }>} */
        const found = await detector.detect(source);
        return found.filter((barcode) => barcode.rawValue).map((barcode) => ({ text: barcode.rawValue, format: LABELS[barcode.format] ?? barcode.format, bytes: byteLength(barcode.rawValue), orientation: Number.NaN }));
      },
    };
  } catch {
    return null;
  }
}
