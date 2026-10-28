import { describe, expect, it } from "vitest";
import { ReadConfirmer } from "./confirm.js";

describe("ReadConfirmer", () => {
  it("accepts codes with a check digit straight away", () => {
    const confirmer = new ReadConfirmer();
    expect(confirmer.accept({ text: "4006381333931", format: "EAN-13" }, 0)).toBe(true);
    expect(confirmer.accept({ text: "hello", format: "QR Code" }, 0)).toBe(true);
  });

  it("waits for a second matching read of codes without one", () => {
    const confirmer = new ReadConfirmer();
    expect(confirmer.accept({ text: "ABC-123", format: "Code 39" }, 0)).toBe(false);
    expect(confirmer.accept({ text: "ABC-128", format: "Code 39" }, 100)).toBe(false);
    expect(confirmer.accept({ text: "ABC-123", format: "Code 39" }, 200)).toBe(true);
  });

  it("doesn't pair reads that are too far apart", () => {
    const confirmer = new ReadConfirmer();
    expect(confirmer.accept({ text: "A1234B", format: "Codabar" }, 0)).toBe(false);
    expect(confirmer.accept({ text: "A1234B", format: "Codabar" }, 5000)).toBe(false);
    expect(confirmer.accept({ text: "A1234B", format: "Codabar" }, 5300)).toBe(true);
  });
});
