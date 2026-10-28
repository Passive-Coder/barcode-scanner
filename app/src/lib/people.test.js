import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePeople } from "./people.js";

describe("parsePeople", () => {
  it("reads emails with or without names", () => {
    const { people, invalid } = parsePeople(`Ann Lee <Ann@Example.com>
ben@example.com, "Cruz, Dee" <dee@example.com>; Eve Park\teve@example.com
not an email`);
    assert.deepEqual(people, [
      { email: "ann@example.com", name: "Ann Lee" },
      { email: "ben@example.com", name: "" },
      { email: "dee@example.com", name: "Cruz, Dee" },
      { email: "eve@example.com", name: "Eve Park" },
    ]);
    assert.deepEqual(invalid, ["not an email"]);
  });

  it("merges duplicates, keeping a name if one is given", () => {
    assert.deepEqual(parsePeople("ann@example.com\nAnn <ann@example.com>").people, [{ email: "ann@example.com", name: "Ann" }]);
  });
});
