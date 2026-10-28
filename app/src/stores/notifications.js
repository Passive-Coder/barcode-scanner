import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "../lib/api/client.js";
import { config } from "../lib/config.js";
import { errorMessage } from "../lib/format.js";
import { Store } from "../lib/store.js";
import { account } from "./account.js";

/**
 * Push notifications for alerts on this phone, through Expo's push service (Apple's and Google's
 * underneath). Pages use a loud Android channel and time-sensitive delivery on iOS.
 */

const PAGE_CHANNEL = "pages";
const ALERT_CHANNEL = "alerts";

/** @returns {string} the Expo project ID push tokens are issued for */
const projectId = () => config.easProjectId || /** @type {any} */ (Constants.expoConfig?.extra)?.eas?.projectId || "";

class NotificationStore extends Store {
  /** Push needs a real phone (not a simulator) and the native app. */
  supported = Platform.OS !== "web" && Device.isDevice;
  /** @type {"undetermined" | "granted" | "denied"} */
  permission = "undetermined";
  enabled = false;
  busy = false;
  /** Why notifications couldn't be turned on, if they couldn't. */
  problem = "";
  #token = "";

  /** Whether this build can get push tokens (it was built with an Expo project ID). */
  get configured() {
    return Boolean(projectId());
  }

  /** Android channels must exist before the first notification arrives. */
  async prepare() {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync(PAGE_CHANNEL, {
      name: "Pages",
      description: "Urgent pages from your organizers and managers.",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 160, 400, 160, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: "Alerts",
      description: "Notices from your events.",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  async #currentToken() {
    const id = projectId();
    if (!id) throw new Error("Notifications aren't set up in this build yet (no Expo project ID).");
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  }

  /** After sign-in: if notifications are allowed on this phone, make sure they reach this person. */
  async sync() {
    if (!this.supported || !this.configured) return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      this.permission = status;
      if (status === "granted" && account.ready) {
        this.#token = await this.#currentToken();
        await api.post("/push/native", { token: this.#token, platform: Platform.OS });
        this.enabled = true;
      } else {
        this.enabled = false;
      }
    } catch (error) {
      console.warn("Could not check notifications on this phone.", error);
      this.enabled = false;
    }
    this.changed();
  }

  /** Asks for permission and registers this phone for alerts. */
  async enable() {
    if (!this.supported) throw new Error("Notifications need the Linework app on a phone (not a simulator or browser).");
    if (!account.ready) throw new Error("Notifications need Linework's server, which can't be reached right now.");
    this.busy = true;
    this.problem = "";
    this.changed();
    try {
      await this.prepare();
      const current = await Notifications.getPermissionsAsync();
      const result = current.status === "granted" ? current : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      this.permission = result.status;
      if (result.status !== "granted") {
        throw new Error(result.status === "denied" ? "Notifications are turned off for Linework. Turn them on in your phone's Settings, then try again." : "Notifications weren't allowed.");
      }
      this.#token = await this.#currentToken();
      await api.post("/push/native", { token: this.#token, platform: Platform.OS });
      this.enabled = true;
    } catch (error) {
      this.problem = errorMessage(error);
      throw error;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  /** Stops alerts reaching this phone. */
  async disable() {
    this.busy = true;
    this.changed();
    try {
      const token = this.#token || (await this.#currentToken().catch(() => ""));
      if (token && account.ready) await api.post("/push/native/remove", { token }).catch(() => {});
      this.enabled = false;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  /** On sign-out, this phone stops receiving the person's alerts. */
  async release() {
    if (this.enabled) await this.disable().catch((error) => console.warn("Could not turn off notifications.", error));
  }
}

export const notifications = new NotificationStore();
