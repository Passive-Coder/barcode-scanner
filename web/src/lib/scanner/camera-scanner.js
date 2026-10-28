import { ReadConfirmer } from "./confirm.js";
import { decode, warmUpDecoder } from "./decoder.js";
import { createNativeDetector } from "./native-detector.js";
import { createScan, readPixels } from "./scan.js";

/**
 * Each frame gets one read, taking turns so codes held anywhere are found quickly:
 * - "native": the browser's built-in detector, where there is one (a few milliseconds a frame);
 * - "quick": zxing on the middle of the frame at full resolution, where people usually aim, with
 *   its fastest settings, so a code held up to the camera is read almost at once;
 * - "thorough": zxing on the whole frame, trying rotated, light-on-dark, and smaller codes.
 * With the built-in detector, zxing still gets every ZXING_EVERY-th frame, for codes it misses.
 */
const ZXING_EVERY = 4;
/** The share of the frame's width and height the quick read looks at. */
const CENTER_SHARE = 0.6;
/** The thorough read scales frames down to this; zxing also tries smaller sizes itself. */
const THOROUGH_EDGE = 1600;
/** Guards only against unusually large sensors in the quick read. */
const MAX_FRAME_EDGE = 3840;
/** Lower bound between reads; the decoder's own speed is the usual limit. */
const MIN_FRAME_INTERVAL_MS = 40;
/** Consecutive decoder failures before the camera gives up and reports the problem. */
const MAX_FAILURES = 3;

/** @type {import("zxing-wasm/reader").ReaderOptions} */
const QUICK_OPTIONS = { tryHarder: false, tryRotate: false, tryInvert: false, tryDownscale: false, maxNumberOfSymbols: 1 };
/** @type {import("zxing-wasm/reader").ReaderOptions} */
const THOROUGH_OPTIONS = { tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4 };

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
  /** @type {{ canvas?: OffscreenCanvas | HTMLCanvasElement }} */ #quickCanvas = {};
  /** @type {{ canvas?: OffscreenCanvas | HTMLCanvasElement }} */ #thoroughCanvas = {};
  /** @type {Promise<import("./native-detector.js").NativeDetector | null> | undefined} */ #native;
  #confirmer = new ReadConfirmer();
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
    this.#native ??= createNativeDetector();
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
    await this.#tuneCamera();
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

  /** Continuous autofocus where the camera offers it, so codes held close come into focus. */
  async #tuneCamera() {
    const track = this.#track;
    const capabilities = /** @type {any} */ (track?.getCapabilities?.() ?? {});
    if (!track || !capabilities.focusMode?.includes?.("continuous")) return;
    await track.applyConstraints(/** @type {any} */ ({ advanced: [{ focusMode: "continuous" }] })).catch(() => {});
  }

  /** @param {number} session */
  async #loop(session) {
    const video = this.#video;
    const native = await (this.#native ??= createNativeDetector());
    let lastDecode = 0;
    let failures = 0;
    let frame = 0;
    let zxingTurn = 0;
    while (video && session === this.#session) {
      await nextFrame(video);
      if (session !== this.#session) return;
      const now = performance.now();
      if (now - lastDecode < MIN_FRAME_INTERVAL_MS || video.readyState < 2 || !video.videoWidth) continue;
      lastDecode = now;
      try {
        const pass = native && frame++ % ZXING_EVERY !== 0 ? "native" : zxingTurn++ % 2 === 0 ? "quick" : "thorough";
        const barcodes = await this.#read(video, pass, native);
        failures = 0;
        const accepted = barcodes.filter((barcode) => this.#confirmer.accept(barcode));
        if (session === this.#session && accepted.length) {
          this.onResults(accepted.map((barcode) => createScan(barcode, { origin: "camera", source: "Camera" })));
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

  /**
   * @param {HTMLVideoElement} video
   * @param {"native" | "quick" | "thorough"} pass
   * @param {import("./native-detector.js").NativeDetector | null} native
   */
  #read(video, pass, native) {
    const { videoWidth: width, videoHeight: height } = video;
    if (pass === "native" && native) return native.detect(video);
    if (pass === "quick") {
      const crop = { width: Math.round(width * CENTER_SHARE), height: Math.round(height * CENTER_SHARE), x: 0, y: 0 };
      crop.x = Math.round((width - crop.width) / 2);
      crop.y = Math.round((height - crop.height) / 2);
      return decode(readPixels(video, width, height, MAX_FRAME_EDGE, this.#quickCanvas, crop), QUICK_OPTIONS);
    }
    return decode(readPixels(video, width, height, THOROUGH_EDGE, this.#thoroughCanvas), THOROUGH_OPTIONS);
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

  /** The camera's zoom range, if it can zoom; zooming in helps with small or distant codes. @returns {{ min: number, max: number, step: number } | null} */
  get zoomRange() {
    const zoom = /** @type {any} */ (this.#track?.getCapabilities?.())?.zoom;
    return zoom && zoom.max > zoom.min ? { min: zoom.min, max: zoom.max, step: zoom.step || 0.1 } : null;
  }

  get zoom() {
    return Number(/** @type {any} */ (this.#track?.getSettings?.())?.zoom) || this.zoomRange?.min || 1;
  }

  /** @param {number} value */
  async setZoom(value) {
    const range = this.zoomRange;
    if (!range || !this.#track) return;
    await this.#track.applyConstraints(/** @type {any} */ ({ advanced: [{ zoom: Math.min(range.max, Math.max(range.min, value)) }] }));
  }
}
