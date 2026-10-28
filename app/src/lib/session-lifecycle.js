import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { account } from "../stores/account.js";
import { alerts } from "../stores/alerts.js";
import { auth } from "../stores/auth.js";
import { changeLog } from "../stores/changes.js";
import { dialogs } from "../stores/dialogs.js";
import { events } from "../stores/events.js";
import { notifications } from "../stores/notifications.js";
import { teams } from "../stores/teams.js";
import { toast } from "../stores/toast.js";
import { workspace } from "../stores/workspace.js";
import { pluralize } from "./format.js";

/** How often an open event is re-read, so documents, people, and alerts others add show up. */
const EVENT_REFRESH_MS = 15_000;
/** Document sharing still to be done in Google Drive is retried every this many event refreshes. */
const SHARING_EVERY = 4;

let started = false;

/**
 * What happens when the Linework session opens and ends, and the background work that keeps the
 * app in step with Google: stored changes are pushed into Google Sheets as soon as Google
 * responds, the open tab and event refresh live, and document sharing catches up on its own.
 * (Mirrors web/src/lib/session-lifecycle.js.)
 */
export function startSessionLifecycle() {
  if (started) return;
  started = true;

  account.onReady(() => {
    alerts.start();
    void changeLog.sync();
    void notifications.sync();
    void events.syncPendingSharing();
    // A fresh session (or another account) is a fresh chance for anything that was refused.
    changeLog.unblock();
    changeLog.startAuto();
  });

  // Runs before the session ends, while the server still accepts this phone's requests.
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

  // Coming back to the app is a good moment to retry, and to catch up on what changed meanwhile.
  AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    if (account.ready) {
      changeLog.nudge();
      if (events.selectedId) void events.refresh().catch(() => {});
    } else if (account.status === "unavailable") {
      void account.ensure();
    }
  });

  if (Platform.OS !== "web") {
    // Alerts that arrive while the app is open are shown in it too (pages fill the screen).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    Notifications.addNotificationReceivedListener(() => void alerts.poll());
    void notifications.prepare().catch((error) => console.warn("Could not set up notification channels.", error));
  }

  workspace.startLiveUpdates();

  let ticks = 0;
  setInterval(() => {
    if (!account.ready || AppState.currentState !== "active") return;
    if (events.selectedId && !dialogs.form && !dialogs.confirmation) void events.refresh().catch(() => {});
    if (++ticks % SHARING_EVERY === 0) void events.syncPendingSharing();
  }, EVENT_REFRESH_MS);
}

/**
 * At launch: reads what's kept on the phone and signs back in to Google if possible. Resolves
 * then, so the first screen can show; the Linework session reopens (or starts) after that.
 */
export async function restoreSession() {
  await Promise.all([workspace.load(), auth.restore()]);
  void account.restore().then((restored) => {
    if (!restored && auth.connected && account.status !== "unavailable") void account.start();
  });
}
