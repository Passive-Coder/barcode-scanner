export function interpret(text, format) {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return { kind: "Website", fields: [["Host", url.hostname], ["Path", url.pathname + url.search]], link: url.href };
    } catch { /* Show the raw text below. */ }
  }
  if (/^mailto:/i.test(value)) {
    return { kind: "Email address", fields: [["Address", value.slice(7).split("?")[0]]] };
  }
  if (/^tel:/i.test(value)) {
    return { kind: "Phone number", fields: [["Number", value.slice(4)]] };
  }
  if (value.startsWith("WIFI:")) {
    const fields = Object.fromEntries([...value.matchAll(/(?:^|;)([ST]):((?:\\.|[^;])*)/g)].map((m) => [m[1], m[2].replace(/\\([;:,\\])/g, "$1")]));
    return { kind: "Wi-Fi network", fields: [["Network", fields.S || "Unknown"], ["Security", fields.T || "None"]] };
  }
  if (/^(BEGIN:VCARD|MECARD:)/i.test(value)) return { kind: "Contact", fields: [] };
  if (/^(EAN|UPC|GTIN)/i.test(format) && /^\d+$/.test(value)) {
    return { kind: "Product identifier", fields: [["Digits", String(value.length)]] };
  }
  return { kind: "Plain text", fields: [] };
}
