/**
 * Barcode types with no check digit can be misread from a blurry or partly covered code: one
 * bar read wrongly still gives a plausible value. Those are only accepted once two frames in a
 * row agree, which takes a fraction of a second while the camera is pointed at the code.
 * Formats with a check digit (EAN, UPC, Code 128, QR and the other 2D codes) are accepted at once.
 */
const UNCHECKED = new Set(["Code 39", "Codabar", "ITF"]);
/** Two reads further apart than this don't confirm each other. */
const CONFIRM_WINDOW_MS = 1500;

export class ReadConfirmer {
  /** @type {Map<string, number>} `${format}\n${text}` → when it was last read */
  #seen = new Map();

  /**
   * @param {{ text: string, format: string }} barcode
   * @param {number} [now]
   * @returns {boolean} whether to accept this read
   */
  accept({ text, format }, now = Date.now()) {
    if (!UNCHECKED.has(format)) return true;
    for (const [key, at] of this.#seen) if (now - at > CONFIRM_WINDOW_MS) this.#seen.delete(key);
    const key = `${format}\n${text}`;
    const confirmed = this.#seen.has(key);
    this.#seen.set(key, now);
    return confirmed;
  }
}
