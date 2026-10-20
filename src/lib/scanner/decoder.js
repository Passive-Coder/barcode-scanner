/**
 * Main-thread client for the zxing-wasm worker. Requests are matched to replies by id, and
 * frame pixels are transferred rather than copied.
 *
 * @typedef {import("./zxing.worker.js").DecodedBarcode} DecodedBarcode
 * @typedef {import("zxing-wasm/reader").ReaderOptions} ReaderOptions
 */

/** @type {Worker | undefined} */
let worker;
let nextId = 0;
/** @type {Map<number, { resolve: (results: DecodedBarcode[]) => void, reject: (error: Error) => void }>} */
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./zxing.worker.js", import.meta.url), { type: "module", name: "zxing-decoder" });
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(`The barcode decoder failed: ${data.error}`));
    else request.resolve(data.results);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    const error = new Error("The barcode decoder could not load. Check your connection and reload the page.");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    worker?.terminate();
    worker = undefined;
  };
  return worker;
}

/**
 * @param {object} message
 * @param {Transferable[]} [transfer]
 * @returns {Promise<DecodedBarcode[]>}
 */
function send(message, transfer = []) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, ...message }, transfer);
  });
}

/** Starts the worker and compiles the WASM ahead of the first scan. */
export function warmUpDecoder() {
  send({ type: "warmup" }).catch((error) => console.warn("Barcode decoder warm-up failed.", error));
}

/**
 * Decodes every barcode in an image. The image's pixel buffer is handed to the worker, so the
 * caller must not use `image` afterwards.
 * @param {ImageData} image
 * @param {ReaderOptions} options
 */
export function decode(image, options) {
  return send({ type: "decode", image, options }, [image.data.buffer]);
}
