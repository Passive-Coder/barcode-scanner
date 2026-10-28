/**
 * Barcode types the camera scans for, and their display names. The names match the website's
 * (and the parser's checks, such as EAN and UPC codes being product identifiers).
 *
 * @typedef {import("expo-camera").BarcodeType} BarcodeType
 */

/** @type {BarcodeType[]} */
export const BARCODE_TYPES = ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "codabar", "itf14", "datamatrix", "pdf417", "aztec"];

/** @type {Record<string, string>} */
const LABELS = {
  qr: "QR Code",
  qrcode: "QR Code",
  ean13: "EAN-13",
  ean8: "EAN-8",
  upc_a: "UPC-A",
  upc_e: "UPC-E",
  code128: "Code 128",
  code39: "Code 39",
  code93: "Code 93",
  codabar: "Codabar",
  itf14: "ITF-14",
  interleaved2of5: "ITF",
  datamatrix: "Data Matrix",
  pdf417: "PDF417",
  aztec: "Aztec",
};

// expo-camera's Android native scanner returns ML Kit's numeric format constants.
/** @type {Record<number, string>} */
const ANDROID_LABELS = {
  1: "Code 128",
  2: "Code 39",
  4: "Code 93",
  8: "Codabar",
  16: "Data Matrix",
  32: "EAN-13",
  64: "EAN-8",
  128: "ITF-14",
  256: "QR Code",
  512: "UPC-A",
  1024: "UPC-E",
  2048: "PDF417",
  4096: "Aztec",
};

/**
 * @param {string | number | null | undefined} type as reported by the scanner (for example "ean13", or "org.gs1.EAN-13" on older iOS)
 */
export function formatLabel(type) {
  if (typeof type === "number") return ANDROID_LABELS[type] ?? "Unknown format";
  if (!type) return "Unknown format";
  const key = type.replace(/^(org\.(gs1|iso|ansi)\.|com\.intermec\.)/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const known = Object.entries(LABELS).find(([name]) => name.replace(/_/g, "") === key);
  if (known) return known[1];
  return type || "Unknown format";
}
