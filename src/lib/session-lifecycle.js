import { account } from "./stores/account.svelte.js";
import { alerts } from "./stores/alerts.svelte.js";
import { auth } from "./stores/auth.svelte.js";
import { changeLog } from "./stores/changes.svelte.js";
import { events } from "./stores/events.svelte.js";
import { notifications } from "./stores/notifications.svelte.js";
import { teams } from "./stores/teams.svelte.js";

/**
 * What happens when the Linework session opens and ends. Kept in one place so the order is
 * easy to follow: everything that needs the server starts after sign-in, and everything tied
 * to the person is cleared on sign-out.
 */
export function startSessionLifecycle() {
  account.onReady(() => {
    alerts.start();
    void changeLog.sync();
    void notifications.sync();
    void events.syncPendingSharing();
  });

  // Runs before the session ends, while the server still accepts this device's requests.
  account.onEnd(async () => {
    await notifications.release();
    alerts.stop();
    events.reset();
    teams.reset();
    changeLog.reset();
  });

  // Back online: reopen the session if it couldn't be opened, and upload waiting changes.
  window.addEventListener("online", () => {
    if (account.ready) void changeLog.upload().then(() => changeLog.refreshSummary());
    else if (auth.connected) void account.start();
  });
}
