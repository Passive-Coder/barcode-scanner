import { api } from "../api/client.js";
import { account } from "./account.svelte.js";
import { toast } from "./toast.svelte.js";

/**
 * Alerts sent to the signed-in person. A "page" takes over the screen until it's
 * acknowledged; a "notice" appears in the alerts list and as a short message.
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

const POLL_MS = 20_000;
/** Pages older than this no longer take over the screen; they stay in the list. */
const PAGE_WINDOW_MS = 12 * 60 * 60 * 1000;

class AlertStore {
  /** @type {Alert[]} newest first */
  inbox = $state.raw([]);
  /** Opened from the bell, or from a notification. */
  inboxOpen = $state(false);
  /** Alert IDs the person has acknowledged on this page, before the server confirms. */
  #acknowledged = new Set();
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #timer;
  #loaded = false;
  #serverOffset = 0;

  /** Unacknowledged pages, oldest first: each takes over the screen in turn. */
  pages = $derived(
    this.inbox.filter((alert) => alert.urgency === "page" && !alert.acknowledgedAt && Date.now() + this.#serverOffset - alert.createdAt < PAGE_WINDOW_MS).reverse(),
  );
  unread = $derived(this.inbox.filter((alert) => !alert.acknowledgedAt).length);

  start() {
    this.stop();
    void this.poll();
    this.#timer = setInterval(() => {
      if (document.visibilityState === "visible") void this.poll();
    }, POLL_MS);
    document.addEventListener("visibilitychange", this.#onVisible);
    navigator.serviceWorker?.addEventListener("message", this.#onMessage);
    this.#openFromHash();
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = undefined;
    document.removeEventListener("visibilitychange", this.#onVisible);
    navigator.serviceWorker?.removeEventListener("message", this.#onMessage);
    this.inbox = [];
    this.inboxOpen = false;
    this.#loaded = false;
    this.#acknowledged.clear();
  }

  #onVisible = () => {
    if (document.visibilityState === "visible") void this.poll();
  };

  /** The service worker forwards pushes to open pages so a page shows without waiting for a poll. @param {MessageEvent} event */
  #onMessage = (event) => {
    if (event.data?.type === "linework-alert") void this.poll();
    if (event.data?.type === "linework-alert-open") {
      void this.poll();
      this.inboxOpen = true;
    }
  };

  /** A notification opened Linework with #alert=…: show the alerts list. */
  #openFromHash() {
    if (!location.hash.startsWith("#alert=")) return;
    this.inboxOpen = true;
    history.replaceState(null, "", location.pathname + location.search);
  }

  async poll() {
    if (!account.ready) return;
    try {
      const { alerts, now } = await api.get("/alerts/inbox");
      this.#serverOffset = typeof now === "number" ? now - Date.now() : 0;
      const previous = new Set(this.inbox.map((alert) => alert.id));
      this.inbox = /** @type {Alert[]} */ (alerts).map((alert) => (this.#acknowledged.has(alert.id) && !alert.acknowledgedAt ? { ...alert, acknowledgedAt: Date.now() } : alert));
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
    try {
      await api.post(`/alerts/${encodeURIComponent(id)}/ack`);
    } catch (error) {
      console.warn("Could not acknowledge the alert.", error);
      toast.error("Couldn't reach Linework to acknowledge this alert. Try again.");
      this.#acknowledged.delete(id);
      this.inbox = this.inbox.map((alert) => (alert.id === id ? { ...alert, acknowledgedAt: null } : alert));
    }
  }
}

export const alerts = new AlertStore();
