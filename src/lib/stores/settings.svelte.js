import { GOOGLE_CLIENT_ID_PATTERN, config } from "../config.js";
import { STORAGE_KEYS, readString, writeString } from "../storage.js";

/**
 * Per-browser overrides for the build-time configuration in `.env`. An override wins over the
 * environment value; clearing it restores the environment default.
 */
class SettingsStore {
  clientIdOverride = $state(readString(STORAGE_KEYS.clientId));

  get clientId() {
    return this.clientIdOverride || config.googleClientId;
  }

  /** @param {string} value @returns {boolean} whether the effective client ID changed */
  saveClientId(value) {
    const next = value.trim();
    if (!GOOGLE_CLIENT_ID_PATTERN.test(next)) throw new Error("Enter a valid Google OAuth Web Client ID (…apps.googleusercontent.com).");
    const changed = next !== this.clientId;
    this.clientIdOverride = next === config.googleClientId ? "" : next;
    writeString(STORAGE_KEYS.clientId, this.clientIdOverride);
    return changed;
  }

  /** @returns {boolean} whether the effective client ID changed */
  resetClientId() {
    const changed = this.clientIdOverride !== "" && this.clientIdOverride !== config.googleClientId;
    this.clientIdOverride = "";
    writeString(STORAGE_KEYS.clientId, "");
    return changed;
  }
}

export const settings = new SettingsStore();
