import { decode, warmUpDecoder } from "./decoder.js";
import { createScan, readPixels } from "./scan.js";

/**
 * Every frame is decoded whole, at the camera's own resolution (1920×1080 is requested). The cap
 * only guards against unusually large sensors; zxing downscales internally when that is faster.
 */
const MAX_FRAME_EDGE = 3840;
/** Lower bound between decodes; the worker's own speed is the usual limit. */
const MIN_FRAME_INTERVAL_MS = 80;
/** Consecutive decoder failures before the camera gives up and reports the problem. */
const MAX_FAILURES = 3;

/** @type {import("zxing-wasm/reader").ReaderOptions} */
const CAMERA_OPTIONS = { tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4 };

/** @param {HTMLVideoElement} video */
function nextFrame(video) {
  return new Promise((resolve) => {
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(() => resolve(undefined));
    else requestAnimationFrame(() => resolve(undefined));
  });
}

/**
 * Live camera scanning: a getUserMedia preview whose frames are decoded by zxing-wasm in a
 * worker. Only one frame is in flight at a time, so a slow device simply decodes less often.
 */
export class CameraScanner {
  /** @type {MediaStream | null} */ #stream = null;
  /** @type {HTMLVideoElement | null} */ #video = null;
  /** @type {HTMLElement | null} */ #container = null;
  /** @type {{ canvas?: OffscreenCanvas | HTMLCanvasElement }} */ #frameCanvas = {};
  /** Incremented on every start and stop, so a stale loop exits instead of running twice. */
  #session = 0;
  active = false;
  selectedCameraId = "";
  /** @type {(error: unknown) => void} */
  onError = () => {};
  /** Called when the feed's dimensions change (camera switch, device rotation). */
  onResize = () => {};

  /** @param {{ onResults: (scans: import("../barcode/fields.js").RawScan[]) => void }} options */
  constructor({ onResults }) {
    this.onResults = onResults;
  }

  /** Places the preview inside `container`; it survives component remounts. @param {HTMLElement | null} container */
  attach(container) {
    this.#container = container;
    if (container && this.#video) container.replaceChildren(this.#video);
  }

  warmUp() {
    warmUpDecoder();
  }

  /** @param {string} [deviceId] @returns {Promise<Array<{ deviceId: string, label: string }>>} */
  async start(deviceId) {
    const session = ++this.#session;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
        // Higher resolution helps with dense 1D barcodes; the browser picks the closest it supports.
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    if (session !== this.#session) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException("Camera start was cancelled.", "AbortError");
    }
    this.#stream = stream;
    if (!this.#video) {
      this.#video = Object.assign(document.createElement("video"), { autoplay: true, playsInline: true, muted: true });
      this.#video.addEventListener("resize", () => this.onResize());
    }
    this.#video.srcObject = stream;
    this.attach(this.#container);
    try {
      await this.#video.play();
      this.active = true;
      this.selectedCameraId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? "";
      this.#loop(session);
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput").map(({ deviceId: id, label }) => ({ deviceId: id, label }));
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  /** @param {number} session */
  async #loop(session) {
    const video = this.#video;
    let lastDecode = 0;
    let failures = 0;
    while (video && session === this.#session) {
      await nextFrame(video);
      if (session !== this.#session) return;
      const now = performance.now();
      if (now - lastDecode < MIN_FRAME_INTERVAL_MS || video.readyState < 2 || !video.videoWidth) continue;
      lastDecode = now;
      try {
        const frame = readPixels(video, video.videoWidth, video.videoHeight, MAX_FRAME_EDGE, this.#frameCanvas);
        const barcodes = await decode(frame, CAMERA_OPTIONS);
        failures = 0;
        if (session === this.#session && barcodes.length) {
          this.onResults(barcodes.map((barcode) => createScan(barcode, { origin: "camera", source: "Camera" })));
        }
      } catch (error) {
        if (++failures >= MAX_FAILURES && session === this.#session) {
          await this.stop();
          this.onError(error);
          return;
        }
      }
    }
  }

  async stop() {
    this.#session++;
    this.active = false;
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = null;
    if (this.#video) this.#video.srcObject = null;
  }

  /** @param {string} deviceId */
  async selectCamera(deviceId) {
    await this.stop();
    await this.start(deviceId);
  }

  /** Width ÷ height of the live feed, so the preview can show all of it; null until known. */
  get aspectRatio() {
    const video = this.#video;
    return this.active && video?.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : null;
  }

  get #track() {
    return this.#stream?.getVideoTracks()[0];
  }

  get torchSupported() {
    return Boolean(/** @type {any} */ (this.#track?.getCapabilities?.())?.torch);
  }

  get torchOn() {
    return Boolean(/** @type {any} */ (this.#track?.getSettings?.())?.torch);
  }

  async toggleTorch() {
    if (!this.torchSupported || !this.#track) return;
    await this.#track.applyConstraints(/** @type {any} */ ({ advanced: [{ torch: !this.torchOn }] }));
  }
}
