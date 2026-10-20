import { describe, expect, it } from "vitest";
import { parsePeople } from "./people.js";

describe("parsePeople", () => {
  it("reads emails with or without names", () => {
    const { people, invalid } = parsePeople(`Ann Lee <Ann@Example.com>
ben@example.com, "Cruz, Dee" <dee@example.com>; Eve Park\teve@example.com
not an email`);
    expect(people).toEqual([
      { email: "ann@example.com", name: "Ann Lee" },
      { email: "ben@example.com", name: "" },
      { email: "dee@example.com", name: "Cruz, Dee" },
      { email: "eve@example.com", name: "Eve Park" },
    ]);
    expect(invalid).toEqual(["not an email"]);
  });

  it("merges duplicates, keeping a name if one is given", () => {
    expect(parsePeople("ann@example.com\nAnn <ann@example.com>").people).toEqual([{ email: "ann@example.com", name: "Ann" }]);
  });

  it("ignores blank entries", () => {
    expect(parsePeople(" ,\n;\n")).toEqual({ people: [], invalid: [] });
  });
});
