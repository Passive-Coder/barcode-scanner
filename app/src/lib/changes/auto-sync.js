/**
 * Runs a background job soon after something changes, then again on a back-off schedule for as
 * long as it reports work left to retry. Used to push stored spreadsheet changes into Google as
 * soon as Google responds again, without anyone pressing a button.
 *
 * `run` resolves to "done" (nothing left, or nothing possible until something changes) or
 * "retry" (work is waiting for Google or the server: try again later). A run that throws counts
 * as "retry". Only one run happens at a time; a nudge during a run schedules another right after.
 *
 * @param {{
 *   run: () => Promise<"done" | "retry">,
 *   delays?: number[],
 *   setTimer?: (callback: () => void, ms: number) => unknown,
 *   clearTimer?: (timer: any) => void,
 * }} options
 */
export function createAutoSync({ run, delays = [2000, 5000, 10000, 20000, 30000], setTimer = setTimeout, clearTimer = clearTimeout }) {
  /** @type {unknown} */
  let timer;
  let attempt = 0;
  let running = false;
  let again = false;
  let active = false;

  /** @param {number} delay */
  const schedule = (delay) => {
    clearTimer(timer);
    timer = setTimer(tick, delay);
  };

  async function tick() {
    timer = undefined;
    if (!active) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    /** @type {"done" | "retry"} */
    let outcome = "retry";
    try {
      outcome = await run();
    } catch (error) {
      console.warn("Background sync failed; it will try again.", error);
    } finally {
      running = false;
    }
    if (!active) return;
    if (again) {
      again = false;
      attempt = 0;
      schedule(0);
    } else if (outcome === "retry") {
      schedule(delays[Math.min(attempt, delays.length - 1)]);
      attempt++;
    } else {
      attempt = 0;
    }
  }

  return {
    get running() {
      return running;
    },
    start() {
      active = true;
      attempt = 0;
      schedule(0);
    },
    stop() {
      active = false;
      attempt = 0;
      again = false;
      clearTimer(timer);
      timer = undefined;
    },
    /** Something changed (a change was stored, the network or Google came back): run soon. @param {number} [delay] */
    nudge(delay = 0) {
      if (!active) return;
      attempt = 0;
      if (running) again = true;
      else schedule(delay);
    },
  };
}
