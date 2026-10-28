const DURATION_MS = { info: 3600, error: 6500 };

class ToastStore {
  message = $state("");
  /** @type {"info" | "error"} */
  tone = $state("info");
  visible = $state(false);
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer;

  /** @param {string} message @param {"info" | "error"} [tone] */
  show(message, tone = "info") {
    this.message = message;
    this.tone = tone;
    this.visible = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.dismiss(), DURATION_MS[tone]);
  }

  /** @param {string} message */
  error(message) {
    this.show(message, "error");
  }

  dismiss() {
    clearTimeout(this.#timer);
    this.visible = false;
  }
}

export const toast = new ToastStore();
