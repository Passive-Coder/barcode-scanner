import { cameraScanner as scanner } from "../scanner/index.js";
import { describeScannerError } from "../scanner/scan.js";
import { toast } from "./toast.svelte.js";

const HINTS = {
  insecure: "Camera access requires localhost or a secure HTTPS connection.",
  idle: "Start the camera to read barcodes in real time.",
  starting: "Starting the camera…",
  live: "Hold a barcode anywhere in view. Results appear automatically.",
  stopped: "Camera stopped. Start again whenever you're ready.",
};

/**
 * Drives the camera through a queue so start, stop, camera switches, and torch changes never
 * overlap. Stopping while a start is still in progress (for example by leaving the screen)
 * waits for the start to settle and then turns the camera off, instead of leaving it running.
 */
class CameraStore {
  live = $state(false);
  busy = $state(false);
  /** @type {Array<{ deviceId: string, label: string }>} */
  cameras = $state.raw([]);
  selectedId = $state("");
  torchSupported = $state(false);
  torchOn = $state(false);
  /** The live feed's width ÷ height, so the preview frame can match it and show the whole image. */
  /** @type {number | null} */
  aspectRatio = $state(null);
  hint = $state(typeof window !== "undefined" && !window.isSecureContext ? HINTS.insecure : HINTS.idle);
  hintIsError = $state(false);
  #wanted = false;
  #pending = 0;
  #queue = Promise.resolve();

  /** @param {() => Promise<void>} task */
  #enqueue(task) {
    this.#pending++;
    this.busy = true;
    const run = this.#queue
      .then(task)
      .catch((error) => this.#fail(error))
      .finally(() => {
        this.#sync();
        if (--this.#pending === 0) this.busy = false;
      });
    this.#queue = run;
    return run;
  }

  #sync() {
    this.live = scanner.active;
    this.selectedId = scanner.active ? scanner.selectedCameraId : this.selectedId;
    this.torchSupported = scanner.active && scanner.torchSupported;
    this.torchOn = scanner.active && scanner.torchOn;
    this.aspectRatio = scanner.aspectRatio;
  }

  /** @param {string} message @param {boolean} [isError] */
  #setHint(message, isError = false) {
    this.hint = message;
    this.hintIsError = isError;
  }

  /** @param {unknown} error */
  #fail(error) {
    console.error("Camera error", error);
    this.#wanted = scanner.active;
    if (/** @type {any} */ (error)?.name === "AbortError") return;
    const message = describeScannerError(error);
    this.#setHint(message, true);
    toast.error(message);
  }

  async #apply() {
    if (this.#wanted && !scanner.active) {
      if (!window.isSecureContext) throw new Error(HINTS.insecure);
      this.#setHint(HINTS.starting);
      this.cameras = await scanner.start();
      this.#setHint(HINTS.live);
    } else if (!this.#wanted && scanner.active) {
      await scanner.stop();
      this.#setHint(HINTS.stopped);
    }
  }

  /** Shows the live preview inside `container`. @param {HTMLElement | null} container */
  attach(container) {
    scanner.attach(container);
  }

  /** Compiles the barcode decoder before the person presses Start. */
  warmUp() {
    scanner.warmUp();
  }

  start() {
    this.#wanted = true;
    return this.#enqueue(() => this.#apply());
  }

  stop() {
    this.#wanted = false;
    return this.#enqueue(() => this.#apply());
  }

  toggle() {
    return this.#wanted ? this.stop() : this.start();
  }

  /** @param {string} deviceId */
  selectCamera(deviceId) {
    return this.#enqueue(async () => {
      if (scanner.active) await scanner.selectCamera(deviceId);
    });
  }

  /** @param {unknown} error */
  reportFailure(error) {
    this.#fail(error);
    this.#sync();
  }

  toggleTorch() {
    return this.#enqueue(async () => {
      if (scanner.active) await scanner.toggleTorch();
    });
  }
}

export const camera = new CameraStore();

// The scanner stops itself if the decoder keeps failing (for example, the WASM can't load).
scanner.onError = (error) => camera.reportFailure(error);
// Rotating the device or switching cameras changes the feed's shape.
scanner.onResize = () => (camera.aspectRatio = scanner.aspectRatio);
