import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutoSync } from "./auto-sync.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutoSync", () => {
  it("runs right away when started", async () => {
    const run = vi.fn(async () => /** @type {const} */ ("done"));
    createAutoSync({ run }).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("backs off while work is left, and stops once it's done", async () => {
    const outcomes = /** @type {const} */ (["retry", "retry", "done"]);
    let call = 0;
    const run = vi.fn(async () => outcomes[call++]);
    createAutoSync({ run, delays: [100, 400] }).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("treats a failed run as work left", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("done");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    createAutoSync({ run, delays: [50] }).start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs again straight after a nudge that arrives mid-run", async () => {
    /** @type {(value: "done") => void} */
    let finish = () => {};
    const run = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const sync = createAutoSync({ run: /** @type {any} */ (run) });
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.nudge();
    expect(run).toHaveBeenCalledTimes(1);
    finish("done");
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does nothing while stopped", async () => {
    const run = vi.fn(async () => /** @type {const} */ ("retry"));
    const sync = createAutoSync({ run, delays: [10] });
    sync.nudge();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).not.toHaveBeenCalled();
    sync.start();
    await vi.advanceTimersByTimeAsync(0);
    sync.stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
