/**
 * Decodes barcodes with zxing-wasm off the main thread, so the camera preview never stutters
 * while a frame is being read.
 */
import { formatToLabel, prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

/**
 * @typedef {{ id: number, type: "warmup" } | { id: number, type: "decode", image: ImageData, options: import("zxing-wasm/reader").ReaderOptions }} DecodeRequest
 * @typedef {{ text: string, format: string, bytes: number, orientation: number }} DecodedBarcode
 */

// zxing-wasm fetches its WASM from a CDN by default; serve the copy bundled with this app instead.
const ready = prepareZXingModule({
  overrides: {
    locateFile: (/** @type {string} */ path, /** @type {string} */ prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  },
  fireImmediately: true,
});

/** @param {MessageEvent<DecodeRequest>} event */
self.onmessage = async ({ data }) => {
  try {
    await ready;
    if (data.type === "warmup") {
      self.postMessage({ id: data.id, results: [] });
      return;
    }
    const results = await readBarcodes(data.image, data.options);
    /** @type {DecodedBarcode[]} */
    const barcodes = results
      .filter((result) => result.isValid)
      .map((result) => ({
        text: result.text,
        format: formatToLabel(result.format) ?? result.format,
        bytes: result.bytes.length,
        orientation: result.orientation,
      }));
    self.postMessage({ id: data.id, results: barcodes });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
