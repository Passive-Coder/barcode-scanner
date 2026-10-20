import { beforeEach, describe, expect, it } from "vitest";
import { createHarness } from "./testing/harness.js";

const SHEET = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd";
const OTHER_SHEET = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210zyxw";

/** @type {ReturnType<typeof createHarness>} */
let harness;

beforeEach(() => {
  harness = createHarness();
});

let counter = 0;
/** @param {Record<string, unknown>} [overrides] */
const change = (overrides = {}) => ({
  id: crypto.randomUUID(),
  spreadsheetId: SHEET,
  spreadsheetTitle: "Inventory",
  sheetId: 0,
  sheetTitle: "Sheet1",
  kind: "append",
  status: "pending",
  payload: { cells: [{ column: 0, header: "Code", value: `item-${++counter}` }] },
  createdAt: harness.now() - 1000 + counter,
  ...overrides,
});

describe("the change log", () => {
  it("stores changes per person and spreadsheet", async () => {
    const alice = await harness.signIn("alice");
    const bob = await harness.signIn("bob");
    const stored = await alice.post("/api/changes", { changes: [change(), change(), change({ status: "applied" }), change({ spreadsheetId: OTHER_SHEET })] });
    expect(stored.status).toBe(201);

    const summary = await alice.get("/api/changes/summary");
    expect(summary.data.spreadsheets).toEqual(
      expect.arrayContaining([
        { spreadsheetId: SHEET, title: "Inventory", pending: 2, conflicts: 0 },
        { spreadsheetId: OTHER_SHEET, title: "Inventory", pending: 1, conflicts: 0 },
      ]),
    );
    expect((await alice.get(`/api/changes?spreadsheetId=${SHEET}&view=history`)).data.changes).toHaveLength(3);
    expect((await bob.get("/api/changes/summary")).data.spreadsheets).toEqual([]);
    expect((await bob.get(`/api/changes?spreadsheetId=${SHEET}&view=history`)).data.changes).toEqual([]);
  });

  it("stores a re-sent change once", async () => {
    const alice = await harness.signIn("alice");
    const once = change();
    await alice.post("/api/changes", { changes: [once] });
    await alice.post("/api/changes", { changes: [once] });
    expect((await alice.get(`/api/changes?spreadsheetId=${SHEET}`)).data.changes).toHaveLength(1);
  });

  it("only lets row changes wait for Google", async () => {
    const alice = await harness.signIn("alice");
    const response = await alice.post("/api/changes", { changes: [change({ kind: "delete-tab" })] });
    expect(response.status).toBe(400);
    expect((await alice.post("/api/changes", { changes: [change({ kind: "delete-tab", status: "applied", payload: { title: "Old" } })] })).status).toBe(201);
    expect((await alice.post("/api/changes", { changes: [change({ spreadsheetId: "../../etc" })] })).status).toBe(400);
  });

  it("hands pending changes to one browser at a time, oldest first", async () => {
    const alice = await harness.signIn("alice");
    const first = change();
    const second = change();
    await alice.post("/api/changes", { changes: [second, first].sort((a, b) => b.createdAt - a.createdAt) });

    const claim = await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    expect(claim.data.changes.map((/** @type {any} */ item) => item.id)).toEqual([first.id, second.id]);
    expect(claim.data.changes[0]).toMatchObject({ status: "migrating", payload: first.payload });
    expect((await alice.post("/api/changes/claim", { spreadsheetId: SHEET })).status).toBe(409);

    // Only the claiming browser can report, and only for changes it claimed.
    const stranger = await alice.post("/api/changes/report", { claimId: crypto.randomUUID(), results: [{ id: first.id, status: "applied" }] });
    expect(stranger.data.updated).toBe(0);
    const report = await alice.post("/api/changes/report", {
      claimId: claim.data.claimId,
      results: [
        { id: first.id, status: "applied", message: "" },
        { id: second.id, status: "conflict", message: "Column “Code” no longer exists." },
      ],
    });
    expect(report.data.updated).toBe(2);
    expect((await alice.get("/api/changes/summary")).data.spreadsheets).toEqual([{ spreadsheetId: SHEET, title: "Inventory", pending: 0, conflicts: 1 }]);

    const open = await alice.get(`/api/changes?spreadsheetId=${SHEET}`);
    expect(open.data.changes).toEqual([expect.objectContaining({ id: second.id, status: "conflict", message: "Column “Code” no longer exists." })]);
  });

  it("returns abandoned claims to the queue", async () => {
    const alice = await harness.signIn("alice");
    await alice.post("/api/changes", { changes: [change()] });
    await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    harness.advance(10 * 60 * 1000 + 1);
    const again = await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    expect(again.status).toBe(200);
    expect(again.data.changes).toHaveLength(1);
  });

  it("puts changes back when Google is still unreachable", async () => {
    const alice = await harness.signIn("alice");
    const queued = change();
    await alice.post("/api/changes", { changes: [queued] });
    const claim = await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    await alice.post("/api/changes/report", { claimId: claim.data.claimId, results: [{ id: queued.id, status: "pending", message: "" }] });
    const again = await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    expect(again.data.changes.map((/** @type {any} */ item) => item.id)).toEqual([queued.id]);
  });

  it("lets people retry or discard changes that need attention", async () => {
    const alice = await harness.signIn("alice");
    const bob = await harness.signIn("bob");
    const queued = change();
    await alice.post("/api/changes", { changes: [queued] });
    const claim = await alice.post("/api/changes/claim", { spreadsheetId: SHEET });
    await alice.post("/api/changes/report", { claimId: claim.data.claimId, results: [{ id: queued.id, status: "conflict", message: "Changed elsewhere" }] });

    expect((await bob.post("/api/changes/retry", { ids: [queued.id] })).data.updated).toBe(0);
    expect((await alice.post("/api/changes/retry", { ids: [queued.id] })).data.updated).toBe(1);
    expect((await alice.get("/api/changes/summary")).data.spreadsheets[0].pending).toBe(1);
    expect((await alice.post("/api/changes/discard", { ids: [queued.id] })).data.updated).toBe(1);
    expect((await alice.get("/api/changes/summary")).data.spreadsheets).toEqual([]);
  });
});
