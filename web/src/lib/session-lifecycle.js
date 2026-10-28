import { pluralize } from "./format.js";
import { account } from "./stores/account.svelte.js";
import { alerts } from "./stores/alerts.svelte.js";
import { auth } from "./stores/auth.svelte.js";
import { changeLog } from "./stores/changes.svelte.js";
import { dialogs } from "./stores/dialogs.svelte.js";
import { events } from "./stores/events.svelte.js";
import { notifications } from "./stores/notifications.svelte.js";
import { teams } from "./stores/teams.svelte.js";
import { toast } from "./stores/toast.svelte.js";
import { workspace } from "./stores/workspace.svelte.js";

/** How often an open event is re-read, so documents, people, and alerts others add show up. */
const EVENT_REFRESH_MS = 15_000;
/** Document sharing still to be done in Google Drive is retried every this many event refreshes. */
const SHARING_EVERY = 4;

/**
 * What happens when the Linework session opens and ends, and the background work that keeps
 * Linework in step with Google: stored changes are pushed into Google Sheets as soon as Google
 * responds, the open tab and event refresh live, and document sharing catches up on its own.
 */
export function startSessionLifecycle() {
  account.onReady(() => {
    alerts.start();
    void changeLog.sync();
    void notifications.sync();
    void events.syncPendingSharing();
    // A fresh session (or another account) is a fresh chance for anything that was refused.
    changeLog.unblock();
    changeLog.startAuto();
  });

  // Runs before the session ends, while the server still accepts this device's requests.
  account.onEnd(async () => {
    await notifications.release();
    alerts.stop();
    events.reset();
    teams.reset();
    changeLog.reset();
  });

  // Stored changes that reached Google in the background: say so and show them.
  changeLog.onMigrated((spreadsheetId, { applied, conflicts }, automatic) => {
    if (!automatic) return;
    const title = workspace.links.find((link) => link.id === spreadsheetId)?.title;
    const where = title ? `“${title}”` : "Google Sheets";
    if (applied) toast.show(`${pluralize(applied, "stored change")} added to ${where}${conflicts ? `; ${pluralize(conflicts, "change")} need${conflicts === 1 ? "s" : ""} your attention` : ""}.`);
    else if (conflicts) toast.error(`${pluralize(conflicts, "stored change")} for ${where} couldn't be placed safely. Review them in the change log.`);
    if (spreadsheetId === workspace.activeId) void workspace.reloadRows().catch(() => {});
  });

  // Back online: reopen the session if it couldn't be opened, and push waiting changes.
  window.addEventListener("online", () => {
    if (account.ready) changeLog.nudge();
    else if (auth.connected) void account.start();
  });

  // Returning to the tab is a good moment to retry, and to catch up on what changed meanwhile.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !account.ready) return;
    changeLog.nudge();
    if (events.selectedId) void events.refresh().catch(() => {});
  });

  workspace.startLiveUpdates();

  let ticks = 0;
  setInterval(() => {
    if (!account.ready || document.visibilityState !== "visible") return;
    if (events.selectedId && !dialogs.form && !dialogs.confirmation) void events.refresh().catch(() => {});
    if (++ticks % SHARING_EVERY === 0) void events.syncPendingSharing();
  }, EVENT_REFRESH_MS);
}
