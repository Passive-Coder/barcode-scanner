import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createAutoSync } from "./auto-sync.js";

/** Lets promises settle after advancing fake timers. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

describe("createAutoSync", () => {
  it("backs off while work is left, and stops once it's done", async () => {
    const outcomes = /** @type {const} */ (["retry", "retry", "done"]);
    let calls = 0;
    createAutoSync({ run: async () => outcomes[calls++], delays: [100, 400] }).start();
    mock.timers.tick(0);
    await flush();
    assert.equal(calls, 1);
    mock.timers.tick(99);
    await flush();
    assert.equal(calls, 1);
    mock.timers.tick(1);
    await flush();
    assert.equal(calls, 2);
    mock.timers.tick(400);
    await flush();
    assert.equal(calls, 3);
    mock.timers.tick(10_000);
    await flush();
    assert.equal(calls, 3);
  });

  it("does nothing while stopped, and runs on a nudge once started", async () => {
    let calls = 0;
    const sync = createAutoSync({ run: async () => (calls++, /** @type {const} */ ("done")) });
    sync.nudge();
    mock.timers.tick(100);
    await flush();
    assert.equal(calls, 0);
    sync.start();
    mock.timers.tick(0);
    await flush();
    sync.nudge();
    mock.timers.tick(0);
    await flush();
    assert.equal(calls, 2);
  });
});
