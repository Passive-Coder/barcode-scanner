import { describe, expect, it } from "vitest";
import { analyzeScan, inferTextType, parsePayload } from "./fields.js";

/** @param {string} text @param {string} [format] @returns {import("./fields.js").RawScan} */
const scan = (text, format = "QR Code") => ({
  id: "test",
  text,
  format,
  bytes: new TextEncoder().encode(text).length,
  angle: null,
  origin: "image",
  source: "test.png",
  time: new Date("2026-01-02T03:04:05.000Z"),
});

/** @param {import("./fields.js").ScanField[]} fields */
const byKey = (fields) => Object.fromEntries(fields.map((field) => [field.key, field]));

describe("analyzeScan", () => {
  it("always includes the scan metadata fields", () => {
    const { fields } = analyzeScan(scan("hello"));
    expect(fields.slice(0, 5).map((field) => field.key)).toEqual(["raw", "format", "contentType", "byteSize", "scannedAt"]);
    expect(byKey(fields).scannedAt.value).toBe("2026-01-02T03:04:05.000Z");
    expect(byKey(fields).contentType.value).toBe("Plain text");
  });

  it("flattens JSON objects with typed values", () => {
    const { contentType, fields } = analyzeScan(scan('{"sku":"A-1","qty":3,"ok":true,"meta":{"lot":"L9"}}'));
    const map = byKey(fields);
    expect(contentType).toBe("JSON object");
    expect(map["json.qty"]).toMatchObject({ value: "3", type: "Number" });
    expect(map["json.ok"]).toMatchObject({ value: "true", type: "Boolean" });
    expect(map["json.meta.lot"].value).toBe("L9");
  });

  it("reads URL parts and query parameters and offers the link", () => {
    const result = analyzeScan(scan("https://example.com/items?id=0042&count=7"));
    const map = byKey(result.fields);
    expect(result.contentType).toBe("Website");
    expect(result.link).toBe("https://example.com/items?id=0042&count=7");
    expect(map["url.host"].value).toBe("example.com");
    expect(map["url.query.id"]).toMatchObject({ value: "0042", type: "Text" });
    expect(map["url.query.count"]).toMatchObject({ value: "7", type: "Number" });
  });

  it("parses Wi-Fi codes case-insensitively, including escaped separators", () => {
    const result = analyzeScan(scan("wifi:T:WPA;S:Cafe\\;Guest;P:p@ss;H:false;;"));
    const map = byKey(result.fields);
    expect(result.contentType).toBe("Wi-Fi network");
    expect(map["wifi.ssid"].value).toBe("Cafe;Guest");
    expect(map["wifi.password"].value).toBe("p@ss");
    expect(result.details).toEqual([["Network", "Cafe;Guest"], ["Security", "WPA"]]);
  });

  it("reads vCard and MECARD contacts", () => {
    const vcard = byKey(analyzeScan(scan("BEGIN:VCARD\nFN:Ada Lovelace\nEMAIL;TYPE=work:ada@example.com\nEND:VCARD")).fields);
    expect(vcard["contact.fn"].value).toBe("Ada Lovelace");
    expect(vcard["contact.email"].type).toBe("Email");
    const mecard = byKey(analyzeScan(scan("MECARD:N:Lovelace,Ada;TEL:+441234;;")).fields);
    expect(mecard["contact.n"].value).toBe("Lovelace,Ada");
    expect(mecard["contact.tel"].value).toBe("+441234");
  });

  it("reads GS1 application identifiers", () => {
    const result = analyzeScan(scan("(01)09506000134352(17)251231(10)ABC123", "Code 128"));
    const map = byKey(result.fields);
    expect(result.contentType).toBe("GS1 data");
    expect(map["gs1.01"]).toMatchObject({ label: "GTIN", value: "09506000134352" });
    expect(map["gs1.17"].type).toBe("Date");
  });

  it("does not mistake a phone number in parentheses for GS1 data", () => {
    expect(parsePayload("Call (555) 123-4567 today", "QR Code").contentType).toBe("Plain text");
  });

  it("treats numeric retail codes as identifiers, not numbers", () => {
    const result = analyzeScan(scan("4006381333931", "EAN-13"));
    expect(result.contentType).toBe("Product identifier");
    expect(byKey(result.fields)["product.identifier"].type).toBe("Text");
  });

  it("reads labeled values on lines, semicolons, or commas", () => {
    const lines = byKey(analyzeScan(scan("Name: Ada\nRoom=12\nPaid: true")).fields);
    expect(lines["field.name"].value).toBe("Ada");
    expect(lines["field.room"]).toMatchObject({ value: "12", type: "Number" });
    expect(lines["field.paid"].type).toBe("Boolean");
    expect(byKey(analyzeScan(scan("Name: Ada, Room: 12")).fields)["field.room"].value).toBe("12");
  });

  it("never lets a payload field replace a metadata field", () => {
    const { fields } = analyzeScan(scan('{"x":1}'));
    expect(fields.filter((field) => field.key === "raw")).toHaveLength(1);
  });
});

describe("inferTextType", () => {
  it.each([
    ["42", "Number"],
    ["-3.5", "Number"],
    ["007", "Text"],
    ["1234567890123456", "Text"],
    ["TRUE", "Boolean"],
    ["a@b.co", "Email"],
    ["2026-10-19", "Date"],
    ["https://x.io", "URL"],
  ])("%s → %s", (text, type) => {
    expect(inferTextType(text)).toBe(type);
  });
});
