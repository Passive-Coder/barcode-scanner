import { api } from "../api/client.js";
import { account } from "./account.svelte.js";

/**
 * Push notifications for alerts on this device. The service worker (public/sw.js) shows them
 * even when Linework isn't open. iPhones and iPads support this only once Linework is added
 * to the Home Screen.
 */

const SERVICE_WORKER = "/sw.js";

/** @param {string} base64url @returns {Uint8Array<ArrayBuffer>} */
function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const standalone = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || /** @type {any} */ (navigator).standalone === true);
const appleMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

class NotificationStore {
  supported = supported;
  /** On iPhone and iPad, push needs Linework installed to the Home Screen first. */
  needsInstall = appleMobile && !standalone;
  /** @type {NotificationPermission} */
  permission = $state(supported ? Notification.permission : "denied");
  enabled = $state(false);
  busy = $state(false);
  /** @type {ServiceWorkerRegistration | null} */
  #registration = null;

  async #register() {
    if (!supported) return null;
    this.#registration ??= await navigator.serviceWorker.register(SERVICE_WORKER, { scope: "/" });
    await navigator.serviceWorker.ready;
    return this.#registration;
  }

  /** After sign-in: if this device already has notifications on, make sure they reach this person. */
  async sync() {
    if (!supported) return;
    try {
      const registration = await this.#register();
      const subscription = await registration?.pushManager.getSubscription();
      this.permission = Notification.permission;
      if (subscription && this.permission === "granted" && account.ready) {
        await api.post("/push/subscriptions", subscription.toJSON());
        this.enabled = true;
      } else {
        this.enabled = false;
      }
    } catch (error) {
      console.warn("Could not check notifications on this device.", error);
    }
  }

  /** Turns notifications on. Must run from a click: the browser asks for permission. */
  async enable() {
    if (!supported) throw new Error("This browser can't show notifications from websites.");
    if (this.needsInstall) throw new Error("On iPhone and iPad, add Linework to your Home Screen (Share → Add to Home Screen), then turn on notifications there.");
    if (!account.ready || !account.vapidPublicKey) throw new Error("Notifications need Linework's server, which can't be reached right now.");
    this.busy = true;
    try {
      this.permission = await Notification.requestPermission();
      if (this.permission !== "granted") {
        throw new Error(this.permission === "denied" ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again." : "Notifications weren't allowed.");
      }
      const registration = /** @type {ServiceWorkerRegistration} */ (await this.#register());
      let subscription = await registration.pushManager.getSubscription();
      const key = keyBytes(account.vapidPublicKey);
      // A subscription made for a different server key can't receive Linework's messages.
      const current = subscription?.options.applicationServerKey;
      if (subscription && current && !sameBytes(new Uint8Array(current), key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api.post("/push/subscriptions", subscription.toJSON());
      this.enabled = true;
    } finally {
      this.busy = false;
    }
  }

  /** Turns notifications off for this device. */
  async disable() {
    this.busy = true;
    try {
      const registration = await this.#register();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        if (account.ready) await api.post("/push/subscriptions/remove", { endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
      }
      this.enabled = false;
    } finally {
      this.busy = false;
    }
  }

  /** On sign-out, this device stops receiving the person's alerts. */
  async release() {
    if (this.enabled) await this.disable().catch((error) => console.warn("Could not turn off notifications.", error));
  }
}

/** @param {Uint8Array} a @param {Uint8Array} b */
const sameBytes = (a, b) => a.length === b.length && a.every((byte, index) => byte === b[index]);

export const notifications = new NotificationStore();
