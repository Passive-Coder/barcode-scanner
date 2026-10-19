function classify(value) {
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (/^https?:\/\//i.test(String(value))) return "URL";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return "Email";
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))) return "Date";
  return "Text";
}

function stringify(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function flattenJson(value, prefix = "", output = []) {
  if (output.length >= 40) return output;
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flattenJson(child, prefix ? `${prefix}.${key}` : key, output);
      if (output.length >= 40) break;
    }
  } else if (prefix) {
    output.push({ key: `json.${prefix}`, label: prefix, value: stringify(value), type: classify(value) });
  }
  return output;
}

function parseMecard(text) {
  const labels = { N: "Name", TEL: "Phone", EMAIL: "Email", ADR: "Address", ORG: "Organization", URL: "Website", NOTE: "Note" };
  return text.slice(7).split(";").flatMap((part) => {
    const match = part.match(/^([A-Z]+):(.*)$/i);
    if (!match) return [];
    const name = match[1].toUpperCase();
    if (!labels[name]) return [];
    const value = match[2].trim();
    return [{ key: `contact.${name.toLowerCase()}`, label: labels[name], value, type: classify(value) }];
  });
}

function inferPairType(value) {
  if (/^(true|false)$/i.test(value)) return "Boolean";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && value.length <= 15) return "Number";
  return classify(value);
}

function parsePairs(text) {
  let parts = text.split(/\r?\n|;/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.every((part) => /^[\w ./-]{1,40}\s*[:=]/.test(part))) parts = commaParts;
  }
  if (!parts.length || !parts.every((part) => /^[\w ./-]{1,40}\s*[:=]/.test(part))) return [];
  return parts.slice(0, 40).map((part) => {
    const match = part.match(/^([\w ./-]{1,40})\s*[:=]\s*(.*)$/);
    const label = match[1].trim();
    const value = match[2].trim();
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    return { key: `field.${slug}`, label, value, type: inferPairType(value) };
  });
}

function parseWifi(text) {
  const values = {};
  for (const match of text.slice(5).matchAll(/(?:^|;)([STPH]):((?:\\.|[^;])*)/g)) {
    values[match[1]] = match[2].replace(/\\([;:,\\])/g, "$1");
  }
  return [
    ["wifi.ssid", "Network name", values.S],
    ["wifi.security", "Security", values.T],
    ["wifi.password", "Password", values.P],
    ["wifi.hidden", "Hidden network", values.H],
  ].filter(([, , value]) => value !== undefined).map(([key, label, value]) => ({ key, label, value, type: "Text" }));
}

function parseVcard(text) {
  const labels = { FN: "Full name", N: "Name", ORG: "Organization", EMAIL: "Email", TEL: "Phone", ADR: "Address", TITLE: "Title", URL: "Website" };
  return text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z]+)(?:;[^:]*)?:(.*)$/i);
    if (!match || !labels[match[1].toUpperCase()]) return [];
    const name = match[1].toUpperCase();
    return [{ key: `contact.${name.toLowerCase()}`, label: labels[name], value: match[2].trim(), type: classify(match[2].trim()) }];
  });
}

function parseGs1(text) {
  const labels = { "00": "SSCC", "01": "GTIN", "10": "Batch", "11": "Production date", "15": "Best before", "17": "Expiry date", "21": "Serial number", "30": "Count" };
  return [...text.matchAll(/\((\d{2,4})\)([^()]+)/g)].map((match) => ({
    key: `gs1.${match[1]}`,
    label: labels[match[1]] || `AI ${match[1]}`,
    value: match[2].trim(),
    type: match[1] === "30" ? "Number" : ["11", "15", "17"].includes(match[1]) ? "Date" : "Text",
  }));
}

export function extractScanFields(scan) {
  const text = scan.text || "";
  const trimmed = text.trim();
  let contentType = "Plain text";
  let parsed = [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      contentType = Array.isArray(data) ? "JSON array" : "JSON object";
      parsed = flattenJson(data);
      if (Array.isArray(data)) parsed.unshift({ key: "json.array", label: "Array", value: JSON.stringify(data), type: "JSON" });
    } catch { /* Keep the raw barcode value. */ }
  } else if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      contentType = "Website";
      parsed = [
        { key: "url.host", label: "Host", value: url.hostname, type: "Text" },
        { key: "url.path", label: "Path", value: url.pathname, type: "Text" },
        ...[...url.searchParams].map(([key, value]) => ({ key: `url.query.${key}`, label: key, value, type: classify(value) })),
      ];
    } catch { /* Keep the raw barcode value. */ }
  } else if (/^WIFI:/i.test(trimmed)) {
    contentType = "Wi-Fi network";
    parsed = parseWifi(trimmed);
  } else if (/^(BEGIN:VCARD|MECARD:)/i.test(trimmed)) {
    contentType = "Contact";
    parsed = /^MECARD:/i.test(trimmed) ? parseMecard(trimmed) : parseVcard(trimmed);
  } else if (/^mailto:/i.test(trimmed)) {
    contentType = "Email address";
    parsed = [{ key: "email.address", label: "Email", value: trimmed.slice(7).split("?")[0], type: "Email" }];
  } else if (/^tel:/i.test(trimmed)) {
    contentType = "Phone number";
    parsed = [{ key: "phone.number", label: "Phone", value: trimmed.slice(4), type: "Text" }];
  } else if (/\(\d{2,4}\)/.test(trimmed)) {
    parsed = parseGs1(trimmed);
    if (parsed.length) contentType = "GS1 data";
  } else if (/^(EAN|UPC|GTIN)/i.test(scan.format) && /^\d+$/.test(trimmed)) {
    contentType = "Product identifier";
    parsed = [{ key: "product.identifier", label: "Identifier", value: trimmed, type: "Text" }];
  } else {
    parsed = parsePairs(trimmed);
    if (parsed.length) contentType = "Labeled values";
  }

  const base = [
    { key: "raw", label: "Raw value", value: text, type: classify(text) },
    { key: "format", label: "Barcode format", value: scan.format, type: "Text" },
    { key: "contentType", label: "Content type", value: contentType, type: "Text" },
    { key: "byteSize", label: "Byte size", value: String(scan.bytes), type: "Number" },
    { key: "scannedAt", label: "Scanned at", value: scan.time.toISOString(), type: "Date" },
  ];
  const seen = new Set(base.map((field) => field.key));
  return [...base, ...parsed.filter((field) => {
    if (seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  })];
}
