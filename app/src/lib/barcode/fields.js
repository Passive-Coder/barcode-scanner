import { parseHttpUrl } from "../url.js";

/**
 * Turns a decoded barcode payload into typed fields that can be shown and mapped to sheet columns.
 * (Shared with the website: web/src/lib/barcode/fields.js. Keep the two in step.)
 *
 * @typedef {"Text" | "Number" | "Boolean" | "URL" | "Email" | "Date" | "JSON" | "Other"} FieldType
 * @typedef {{ key: string, label: string, value: string, type: FieldType }} ScanField
 * @typedef {{
 *   id: string,
 *   text: string,
 *   format: string,
 *   bytes: number,
 *   origin: "camera" | "image",
 *   source: string,
 *   time: Date,
 * }} RawScan
 * @typedef {{
 *   contentType: string,
 *   fields: ScanField[],
 *   details: Array<[string, string]>,
 *   link: string | null,
 * }} ScanAnalysis
 */

const MAX_PARSED_FIELDS = 40;
const LABEL = "[\\w ./-]{1,40}";
const LABELED_PART = new RegExp(`^${LABEL}\\s*[:=]`);
const LABELED_PAIR = new RegExp(`^(${LABEL})\\s*[:=]\\s*(.*)$`);

/** @param {unknown} value @returns {FieldType} */
function classify(value) {
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return "URL";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "Email";
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) return "Date";
  return "Text";
}

/**
 * Infers a type for text that came from a labeled value or query parameter. Numbers with
 * leading zeros or more than 15 digits stay text so identifiers keep every digit.
 * @param {string} text @returns {FieldType}
 */
export function inferTextType(text) {
  if (/^(true|false)$/i.test(text)) return "Boolean";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) && text.replace(/[-.]/g, "").length <= 15) return "Number";
  return classify(text);
}

/** @param {unknown} value */
function stringify(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** @param {unknown} value @param {string} [prefix] @param {ScanField[]} [output] */
function flattenJson(value, prefix = "", output = []) {
  if (output.length >= MAX_PARSED_FIELDS) return output;
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flattenJson(child, prefix ? `${prefix}.${key}` : key, output);
      if (output.length >= MAX_PARSED_FIELDS) break;
    }
  } else if (prefix) {
    output.push({ key: `json.${prefix}`, label: prefix, value: stringify(value), type: classify(value) });
  }
  return output;
}

/** @param {string} text */
function unescapeWifi(text) {
  return text.replace(/\\([;:,\\"])/g, "$1");
}

/** @param {string} text */
function parseWifi(text) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const match of text.slice(5).matchAll(/(?:^|;)([STPH]):((?:\\.|[^;])*)/gi)) {
    values[match[1].toUpperCase()] = unescapeWifi(match[2]);
  }
  /** @type {ScanField[]} */
  const fields = [];
  for (const [code, key, label] of [["S", "wifi.ssid", "Network name"], ["T", "wifi.security", "Security"], ["P", "wifi.password", "Password"], ["H", "wifi.hidden", "Hidden network"]]) {
    if (values[code] !== undefined) fields.push({ key, label, value: values[code], type: code === "H" ? inferTextType(values[code]) : "Text" });
  }
  return { fields, details: /** @type {Array<[string, string]>} */ ([["Network", values.S || "Unknown"], ["Security", values.T || "None"]]) };
}

const MECARD_LABELS = { N: "Name", TEL: "Phone", EMAIL: "Email", ADR: "Address", ORG: "Organization", URL: "Website", NOTE: "Note" };
const VCARD_LABELS = { FN: "Full name", N: "Name", ORG: "Organization", EMAIL: "Email", TEL: "Phone", ADR: "Address", TITLE: "Title", URL: "Website" };

/** @param {string} text @returns {ScanField[]} */
function parseMecard(text) {
  return text.slice(7).split(/(?<!\\);/).flatMap((part) => {
    const match = part.match(/^([A-Z]+):(.*)$/i);
    const name = match?.[1].toUpperCase();
    if (!match || !name || !(name in MECARD_LABELS)) return [];
    const value = match[2].replace(/\\([;:,\\])/g, "$1").trim();
    return [{ key: `contact.${name.toLowerCase()}`, label: MECARD_LABELS[/** @type {keyof typeof MECARD_LABELS} */ (name)], value, type: classify(value) }];
  });
}

/** @param {string} text @returns {ScanField[]} */
function parseVcard(text) {
  return text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z]+)(?:;[^:]*)?:(.*)$/i);
    const name = match?.[1].toUpperCase();
    if (!match || !name || !(name in VCARD_LABELS)) return [];
    const value = match[2].trim();
    return [{ key: `contact.${name.toLowerCase()}`, label: VCARD_LABELS[/** @type {keyof typeof VCARD_LABELS} */ (name)], value, type: classify(value) }];
  });
}

const GS1_LABELS = { "00": "SSCC", "01": "GTIN", "10": "Batch", "11": "Production date", "15": "Best before", "17": "Expiry date", "21": "Serial number", "30": "Count" };

/** @param {string} text @returns {ScanField[]} */
function parseGs1(text) {
  return [...text.matchAll(/\((\d{2,4})\)([^()]+)/g)].map((match) => {
    const ai = match[1];
    /** @type {FieldType} */
    const type = ai === "30" ? "Number" : ["11", "15", "17"].includes(ai) ? "Date" : "Text";
    return { key: `gs1.${ai}`, label: GS1_LABELS[/** @type {keyof typeof GS1_LABELS} */ (ai)] ?? `AI ${ai}`, value: match[2].trim(), type };
  });
}

/** Parses `Name: value` / `Name=value` lines, or a comma-separated list of them. @param {string} text */
function parseLabeledValues(text) {
  let parts = text.split(/\r?\n|;/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every((part) => LABELED_PART.test(part))) parts = commaParts;
  }
  if (!parts.length || !parts.every((part) => LABELED_PART.test(part))) return [];
  return parts.slice(0, MAX_PARSED_FIELDS).map((part) => {
    const [, rawLabel = "", rawValue = ""] = part.match(LABELED_PAIR) ?? [];
    const label = rawLabel.trim();
    const value = rawValue.trim();
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    return /** @type {ScanField} */ ({ key: `field.${slug}`, label, value, type: inferTextType(value) });
  });
}

/** @param {string} value */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Identifies what a payload contains and extracts its typed values.
 * @param {string} text
 * @param {string} format
 * @returns {{ contentType: string, parsed: ScanField[], details: Array<[string, string]>, link: string | null }}
 */
export function parsePayload(text, format) {
  const value = text.trim();

  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      const data = JSON.parse(value);
      const parsed = flattenJson(data);
      if (Array.isArray(data)) parsed.unshift({ key: "json.array", label: "Array", value: JSON.stringify(data), type: "JSON" });
      return { contentType: Array.isArray(data) ? "JSON array" : "JSON object", parsed, details: [], link: null };
    } catch {
      return { contentType: "Plain text", parsed: [], details: [], link: null };
    }
  }

  const url = parseHttpUrl(value);
  if (url) {
    /** @type {ScanField[]} */
    const parsed = [
      { key: "url.host", label: "Host", value: url.host, type: "Text" },
      { key: "url.path", label: "Path", value: url.path, type: "Text" },
      ...url.params.map(([key, param]) => /** @type {ScanField} */ ({ key: `url.query.${key}`, label: key, value: param, type: inferTextType(param) })),
    ];
    return { contentType: "Website", parsed, details: [["Host", url.host], ["Path", url.path + url.search]], link: url.href };
  }

  if (/^WIFI:/i.test(value)) {
    const { fields, details } = parseWifi(value);
    return { contentType: "Wi-Fi network", parsed: fields, details, link: null };
  }

  if (/^(BEGIN:VCARD|MECARD:)/i.test(value)) {
    return { contentType: "Contact", parsed: /^MECARD:/i.test(value) ? parseMecard(value) : parseVcard(value), details: [], link: null };
  }

  if (/^mailto:/i.test(value)) {
    const address = safeDecode(value.slice(7).split("?")[0]);
    return { contentType: "Email address", parsed: [{ key: "email.address", label: "Email", value: address, type: "Email" }], details: [["Address", address]], link: null };
  }

  if (/^tel:/i.test(value)) {
    const number = value.slice(4);
    return { contentType: "Phone number", parsed: [{ key: "phone.number", label: "Phone", value: number, type: "Text" }], details: [["Number", number]], link: null };
  }

  // GS1 element strings start with an application identifier such as (01).
  if (/^\(\d{2,4}\)/.test(value)) {
    const parsed = parseGs1(value);
    if (parsed.length) return { contentType: "GS1 data", parsed, details: [], link: null };
  }

  if (/^(EAN|UPC|GTIN)/i.test(format) && /^\d+$/.test(value)) {
    return {
      contentType: "Product identifier",
      parsed: [{ key: "product.identifier", label: "Identifier", value, type: "Text" }],
      details: [["Digits", String(value.length)]],
      link: null,
    };
  }

  const labeled = parseLabeledValues(value);
  return { contentType: labeled.length ? "Labeled values" : "Plain text", parsed: labeled, details: [], link: null };
}

/**
 * Returns every field available for a scan: the payload's own values plus scan metadata that
 * is always present (raw value, format, content type, size, and time).
 * @param {RawScan} scan
 * @returns {ScanAnalysis}
 */
export function analyzeScan(scan) {
  const text = scan.text ?? "";
  const { contentType, parsed, details, link } = parsePayload(text, scan.format);
  /** @type {ScanField[]} */
  const base = [
    { key: "raw", label: "Raw value", value: text, type: classify(text) },
    { key: "format", label: "Barcode format", value: scan.format, type: "Text" },
    { key: "contentType", label: "Content type", value: contentType, type: "Text" },
    { key: "byteSize", label: "Byte size", value: String(scan.bytes), type: "Number" },
    { key: "scannedAt", label: "Scanned at", value: scan.time.toISOString(), type: "Date" },
  ];
  const seen = new Set(base.map((field) => field.key));
  const unique = parsed.filter((field) => !seen.has(field.key) && Boolean(seen.add(field.key)));
  return { contentType, fields: [...base, ...unique], details, link };
}
