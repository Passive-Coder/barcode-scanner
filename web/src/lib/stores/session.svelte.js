import { analyzeScan } from "../barcode/fields.js";
import { CAMERA_DUPLICATE_WINDOW_MS, SESSION_HISTORY_LIMIT } from "../config.js";
import { pluralize } from "../format.js";
import { toast } from "./toast.svelte.js";
import { workspace } from "./workspace.svelte.js";

/**
 * @typedef {import("../barcode/fields.js").RawScan} RawScan
 * @typedef {import("../barcode/fields.js").ScanField} ScanField
 * @typedef {RawScan & { analysis: import("../barcode/fields.js").ScanAnalysis }} Scan
 */

/** @param {Scan} scan @param {RawScan} item */
const isRepeatRead = (scan, item) =>
  scan.origin === "camera" && item.origin === "camera" && scan.format === item.format && scan.text === item.text &&
  item.time.getTime() - scan.time.getTime() < CAMERA_DUPLICATE_WINDOW_MS;

/** Scans captured in this page session (not persisted), newest first. */
class SessionStore {
  /** @type {Scan[]} */
  scans = $state.raw([]);
  /** @type {string | null} */
  selectedId = $state(null);

  selected = $derived(this.scans.find((scan) => scan.id === this.selectedId) ?? this.scans[0] ?? null);

  /** Every distinct field seen this session, newest first: the choices for column mapping. */
  availableFields = $derived.by(() => {
    /** @type {Map<string, ScanField>} */
    const fields = new Map();
    for (const scan of this.scans) {
      for (const field of scan.analysis.fields) if (!fields.has(field.key)) fields.set(field.key, field);
    }
    return [...fields.values()];
  });

  /**
   * Adds decoded results, skipping repeated camera reads of the same code, and records each
   * new scan to the open spreadsheet when recording is set up.
   * @param {RawScan[]} items
   * @returns {number} how many scans were added
   */
  add(items) {
    /** @type {Scan[]} */
    const added = [];
    for (const item of items) {
      if ([...added, ...this.scans].some((scan) => isRepeatRead(scan, item))) continue;
      added.unshift({ ...item, analysis: analyzeScan(item) });
    }
    if (!added.length) return 0;

    this.scans = [...added, ...this.scans].slice(0, SESSION_HISTORY_LIMIT);
    this.selectedId = added[0].id;
    // Browsers block vibration (and log an error) until the page has had a tap.
    if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(60);
    // Shown first so a more specific message from recording can replace it.
    toast.show(`${pluralize(added.length, "barcode")} captured`);
    for (const scan of [...added].reverse()) workspace.record(scan.analysis.fields);
    return added.length;
  }

  /** @param {string} id */
  select(id) {
    this.selectedId = id;
  }

  clear() {
    this.scans = [];
    this.selectedId = null;
    toast.show("Session history cleared");
  }
}

export const session = new SessionStore();
