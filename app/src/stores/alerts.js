import { AppState } from "react-native";
import { api } from "../lib/api/client.js";
import { Store } from "../lib/store.js";
import { account } from "./account.js";
import { toast } from "./toast.js";

/**
 * Alerts sent to the signed-in person. A "page" takes over the screen until it's acknowledged; a
 * "notice" appears in the alerts list and as a short message. Push notifications reach the
 * phone when the app is closed; while it's open, the list is also checked every few seconds.
 * (Mirrors web/src/lib/stores/alerts.svelte.js.)
 *
 * @typedef {{
 *   id: string,
 *   eventId: string,
 *   eventName: string,
 *   senderEmail: string,
 *   senderName: string,
 *   title: string,
 *   body: string,
 *   urgency: "notice" | "page",
 *   audienceLabel: string,
 *   createdAt: number,
 *   acknowledgedAt?: number | null,
 *   recipientCount?: number,
 *   acknowledgedCount?: number,
 * }} Alert
 */

const POLL_MS = 15_000;
/** Pages older than this no longer take over the screen; they stay in the list. */
const PAGE_WINDOW_MS = 12 * 60 * 60 * 1000;

class AlertStore extends Store {
  /** @type {Alert[]} newest first */
  inbox = [];
  /** Alert IDs acknowledged on this device before the server confirms. */
  #acknowledged = new Set();
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #timer;
  /** @type {{ remove: () => void } | undefined} */
  #appState;
  #loaded = false;
  #serverOffset = 0;

  /** Unacknowledged pages, oldest first: each takes over the screen in turn. */
  get pages() {
    const now = Date.now() + this.#serverOffset;
    return this.inbox.filter((alert) => alert.urgency === "page" && !alert.acknowledgedAt && now - alert.createdAt < PAGE_WINDOW_MS).reverse();
  }

  get unread() {
    return this.inbox.filter((alert) => !alert.acknowledgedAt).length;
  }

  start() {
    this.stop();
    void this.poll();
    this.#timer = setInterval(() => {
      if (AppState.currentState === "active") void this.poll();
    }, POLL_MS);
    this.#appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void this.poll();
    });
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = undefined;
    this.#appState?.remove();
    this.#appState = undefined;
    this.inbox = [];
    this.#loaded = false;
    this.#acknowledged.clear();
    this.changed();
  }

  async poll() {
    if (!account.ready) return;
    try {
      const { alerts, now } = await api.get("/alerts/inbox");
      this.#serverOffset = typeof now === "number" ? now - Date.now() : 0;
      const previous = new Set(this.inbox.map((alert) => alert.id));
      this.inbox = /** @type {Alert[]} */ (alerts).map((alert) => (this.#acknowledged.has(alert.id) && !alert.acknowledgedAt ? { ...alert, acknowledgedAt: Date.now() } : alert));
      this.changed();
      // New notices get a short message; pages take over the screen on their own.
      if (this.#loaded) {
        const fresh = this.inbox.find((alert) => !previous.has(alert.id) && alert.urgency === "notice" && !alert.acknowledgedAt);
        if (fresh) toast.show(`${fresh.senderName || fresh.senderEmail}: ${fresh.title}`);
      }
      this.#loaded = true;
    } catch (error) {
      console.warn("Could not check for alerts.", error);
    }
  }

  /** @param {string} id */
  async acknowledge(id) {
    this.#acknowledged.add(id);
    this.inbox = this.inbox.map((alert) => (alert.id === id ? { ...alert, acknowledgedAt: Date.now() } : alert));
    this.changed();
    try {
      await api.post(`/alerts/${encodeURIComponent(id)}/ack`);
    } catch (error) {
      console.warn("Could not acknowledge the alert.", error);
      toast.error("Couldn't reach Linework to acknowledge this alert. Try again.");
      this.#acknowledged.delete(id);
      this.inbox = this.inbox.map((alert) => (alert.id === id ? { ...alert, acknowledgedAt: null } : alert));
      this.changed();
    }
  }
}

export const alerts = new AlertStore();
