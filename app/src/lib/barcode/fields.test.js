import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { byteLength } from "../format.js";
import { analyzeScan, inferTextType, parsePayload } from "./fields.js";
import { formatLabel } from "./formats.js";

/** @param {string} text @param {string} [format] @returns {import("./fields.js").RawScan} */
const scan = (text, format = "QR Code") => ({ id: "test", text, format, bytes: byteLength(text), origin: "image", source: "test.png", time: new Date("2026-01-02T03:04:05.000Z") });

/** @param {import("./fields.js").ScanField[]} fields */
const byKey = (fields) => Object.fromEntries(fields.map((field) => [field.key, field]));

describe("analyzeScan (same results as the website)", () => {
  it("always includes the scan metadata fields", () => {
    const { fields } = analyzeScan(scan("hello"));
    assert.deepEqual(fields.slice(0, 5).map((field) => field.key), ["raw", "format", "contentType", "byteSize", "scannedAt"]);
    assert.equal(byKey(fields).scannedAt.value, "2026-01-02T03:04:05.000Z");
    assert.equal(byKey(fields).contentType.value, "Plain text");
  });

  it("flattens JSON objects with typed values", () => {
    const { contentType, fields } = analyzeScan(scan('{"sku":"A-1","qty":3,"ok":true,"meta":{"lot":"L9"}}'));
    const map = byKey(fields);
    assert.equal(contentType, "JSON object");
    assert.equal(map["json.qty"].type, "Number");
    assert.equal(map["json.ok"].type, "Boolean");
    assert.equal(map["json.meta.lot"].value, "L9");
  });

  it("reads URL parts and query parameters and offers the link", () => {
    const result = analyzeScan(scan("https://example.com/items?id=0042&count=7"));
    const map = byKey(result.fields);
    assert.equal(result.contentType, "Website");
    assert.equal(result.link, "https://example.com/items?id=0042&count=7");
    assert.equal(map["url.host"].value, "example.com");
    assert.equal(map["url.path"].value, "/items");
    assert.deepEqual([map["url.query.id"].value, map["url.query.id"].type], ["0042", "Text"]);
    assert.deepEqual([map["url.query.count"].value, map["url.query.count"].type], ["7", "Number"]);
  });

  it("decodes query values like a browser", () => {
    const map = byKey(analyzeScan(scan("https://x.io/?name=Ada+Lovelace&city=S%C3%A3o%20Paulo")).fields);
    assert.equal(map["url.query.name"].value, "Ada Lovelace");
    assert.equal(map["url.query.city"].value, "São Paulo");
  });

  it("parses Wi-Fi codes, contacts, and GS1 data", () => {
    assert.equal(byKey(analyzeScan(scan("wifi:T:WPA;S:Cafe\\;Guest;P:p@ss;H:false;;")).fields)["wifi.ssid"].value, "Cafe;Guest");
    assert.equal(byKey(analyzeScan(scan("BEGIN:VCARD\nFN:Ada Lovelace\nEND:VCARD")).fields)["contact.fn"].value, "Ada Lovelace");
    assert.equal(byKey(analyzeScan(scan("MECARD:N:Lovelace,Ada;TEL:+441234;;")).fields)["contact.tel"].value, "+441234");
    const gs1 = analyzeScan(scan("(01)09506000134352(17)251231(10)ABC123", "Code 128"));
    assert.equal(gs1.contentType, "GS1 data");
    assert.equal(byKey(gs1.fields)["gs1.01"].label, "GTIN");
  });

  it("treats numeric retail codes as identifiers, using the app's format names", () => {
    const result = analyzeScan(scan("4006381333931", formatLabel("ean13")));
    assert.equal(result.contentType, "Product identifier");
    assert.equal(byKey(result.fields)["product.identifier"].type, "Text");
  });

  it("reads labeled values", () => {
    const lines = byKey(analyzeScan(scan("Name: Ada\nRoom=12\nPaid: true")).fields);
    assert.equal(lines["field.room"].type, "Number");
    assert.equal(lines["field.paid"].type, "Boolean");
    assert.equal(parsePayload("Call (555) 123-4567 today", "QR Code").contentType, "Plain text");
  });

  it("infers text types", () => {
    for (const [text, type] of [["42", "Number"], ["007", "Text"], ["1234567890123456", "Text"], ["TRUE", "Boolean"], ["a@b.co", "Email"], ["2026-10-19", "Date"], ["https://x.io", "URL"]]) {
      assert.equal(inferTextType(text), type, text);
    }
  });
});

describe("formatLabel", () => {
  it("names the scanner's barcode types", () => {
    assert.equal(formatLabel("ean13"), "EAN-13");
    assert.equal(formatLabel("upc_a"), "UPC-A");
    assert.equal(formatLabel("org.gs1.EAN-13"), "EAN-13");
    assert.equal(formatLabel("org.iso.QRCode"), "QR Code");
    assert.equal(formatLabel("code128"), "Code 128");
    assert.equal(formatLabel(256), "QR Code");
    assert.equal(formatLabel(32), "EAN-13");
    assert.equal(formatLabel(undefined), "Unknown format");
    assert.equal(formatLabel("something-new"), "something-new");
  });
});

describe("byteLength", () => {
  it("counts UTF-8 bytes", () => {
    assert.equal(byteLength("abc"), 3);
    assert.equal(byteLength("é"), 2);
    assert.equal(byteLength("€"), 3);
    assert.equal(byteLength("😀"), 4);
  });
});
