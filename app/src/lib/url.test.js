import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSpreadsheetId } from "./sheets/values.js";
import { parseHttpUrl } from "./url.js";

describe("parseHttpUrl", () => {
  it("splits http(s) URLs", () => {
    assert.deepEqual(parseHttpUrl("https://Docs.Google.com:443/spreadsheets/d/abc/edit?usp=sharing#gid=0"), {
      href: "https://docs.google.com:443/spreadsheets/d/abc/edit?usp=sharing#gid=0",
      host: "docs.google.com",
      path: "/spreadsheets/d/abc/edit",
      search: "?usp=sharing",
      params: [["usp", "sharing"]],
    });
    assert.equal(parseHttpUrl("http://example.com")?.path, "/");
  });

  it("ignores credentials, and rejects other schemes and spaces", () => {
    assert.equal(parseHttpUrl("https://user:pass@example.com/x")?.host, "example.com");
    assert.equal(parseHttpUrl("ftp://example.com"), null);
    assert.equal(parseHttpUrl("https://exa mple.com"), null);
    assert.equal(parseHttpUrl("not a url"), null);
  });

  it("reads spreadsheet links", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
    assert.equal(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`), id);
    assert.equal(parseSpreadsheetId(`https://docs.google.com/spreadsheets/u/1/d/${id}/edit`), id);
    assert.equal(parseSpreadsheetId(`  ${id}  `), id);
    assert.throws(() => parseSpreadsheetId(`https://docs.google.com/document/d/${id}/edit`), /Google Sheets/);
    assert.throws(() => parseSpreadsheetId(`https://evil.example/spreadsheets/d/${id}`), /Google Sheets/);
  });
});
