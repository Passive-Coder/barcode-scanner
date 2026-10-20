import { HttpError } from "./http.js";

const EMAIL_PATTERN = /^[^\s@<>()[\]",;:\\]+@[^\s@<>()[\]",;:\\]+\.[^\s@<>()[\]",;:\\]{2,}$/;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Google Drive file IDs (Sheets and Docs use the same IDs). */
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

/** @param {string} message */
const invalid = (message) => new HttpError(400, message);

/**
 * Trims a text field and checks its length. Control characters (other than line breaks in
 * multi-line fields) are removed.
 * @param {unknown} value
 * @param {{ label: string, max: number, min?: number, multiline?: boolean }} options
 */
export function text(value, { label, max, min = 1, multiline = false }) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw invalid(`${label} must be text.`);
  const cleaned = (multiline ? value.replace(/[^\P{Cc}\n\t]/gu, "") : value.replace(/\p{Cc}/gu, " ")).trim();
  if (cleaned.length < min) throw invalid(min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
  if (cleaned.length > max) throw invalid(`${label} must be at most ${max} characters.`);
  return cleaned;
}

/** @param {unknown} value @returns {string} a lowercased email */
export function email(value) {
  const address = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
    throw invalid(`${typeof value === "string" && value.trim() ? `“${value.trim().slice(0, 80)}”` : "That"} is not a valid email address.`);
  }
  return address;
}

/**
 * People given as `{ email, name }`. Duplicates (by email) are merged, keeping the first name given.
 * @param {unknown} value
 * @param {{ max: number }} options
 * @returns {Array<{ email: string, name: string }>}
 */
export function people(value, { max }) {
  if (!Array.isArray(value) || !value.length) throw invalid("Add at least one person.");
  if (value.length > max) throw invalid(`Add at most ${max} people at a time.`);
  /** @type {Map<string, string>} */
  const unique = new Map();
  for (const person of value) {
    const address = email(person?.email);
    const name = text(person?.name, { label: "Name", max: 120, min: 0 });
    if (!unique.has(address) || (!unique.get(address) && name)) unique.set(address, name);
  }
  return [...unique].map(([address, name]) => ({ email: address, name }));
}

/** @param {unknown} value @param {string} [label] */
export function id(value, label = "ID") {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw invalid(`${label} is not valid.`);
  return value.toLowerCase();
}

/** @param {unknown} value @param {number} max @param {string} [label] */
export function ids(value, max, label = "ID") {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalid(`${label} list must be a list.`);
  if (value.length > max) throw invalid(`Choose at most ${max}.`);
  return [...new Set(value.map((item) => id(item, label)))];
}

/** @param {unknown} value @param {number} max */
export function emails(value, max) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalid("Emails must be a list.");
  if (value.length > max) throw invalid(`Choose at most ${max} people.`);
  return [...new Set(value.map(email))];
}

/** @param {unknown} value */
export function fileId(value) {
  if (typeof value !== "string" || !FILE_ID_PATTERN.test(value)) throw invalid("That Google file ID is not valid.");
  return value;
}

/**
 * @template {string} T
 * @param {unknown} value
 * @param {readonly T[]} options
 * @param {string} label
 * @returns {T}
 */
export function oneOf(value, options, label) {
  if (!options.includes(/** @type {T} */ (value))) throw invalid(`${label} must be one of: ${options.join(", ")}.`);
  return /** @type {T} */ (value);
}

/** @param {unknown} value @param {string} label @param {{ min?: number, max?: number }} [range] */
export function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw invalid(`${label} must be a whole number.`);
  return value;
}
