import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReadConfirmer } from "./confirm.js";

describe("ReadConfirmer", () => {
  it("accepts codes with a check digit straight away", () => {
    const confirmer = new ReadConfirmer();
    assert.equal(confirmer.accept({ text: "4006381333931", format: "EAN-13" }, 0), true);
    assert.equal(confirmer.accept({ text: "hello", format: "QR Code" }, 0), true);
  });

  it("waits for a second matching read of codes without one", () => {
    const confirmer = new ReadConfirmer();
    assert.equal(confirmer.accept({ text: "ABC-123", format: "Code 39" }, 0), false);
    assert.equal(confirmer.accept({ text: "ABC-128", format: "Code 39" }, 100), false);
    assert.equal(confirmer.accept({ text: "ABC-123", format: "Code 39" }, 200), true);
  });

  it("doesn't pair reads that are too far apart", () => {
    const confirmer = new ReadConfirmer();
    assert.equal(confirmer.accept({ text: "A1234B", format: "Codabar" }, 0), false);
    assert.equal(confirmer.accept({ text: "A1234B", format: "Codabar" }, 5000), false);
    assert.equal(confirmer.accept({ text: "A1234B", format: "Codabar" }, 5300), true);
  });
});
