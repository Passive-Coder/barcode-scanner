import { Store } from "../lib/store.js";

const DURATION_MS = { info: 3600, error: 6500 };

/** Short messages shown at the bottom of the screen. */
class ToastStore extends Store {
  message = "";
  /** @type {"info" | "error"} */
  tone = "info";
  visible = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;

  /** @param {string} message @param {"info" | "error"} [tone] */
  show(message, tone = "info") {
    this.message = message;
    this.tone = tone;
    this.visible = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.dismiss(), DURATION_MS[tone]);
    this.changed();
  }

  /** @param {string} message */
  error(message) {
    this.show(message, "error");
  }

  dismiss() {
    clearTimeout(this.#timer);
    this.visible = false;
    this.changed();
  }
}

export const toast = new ToastStore();
