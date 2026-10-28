import * as SecureStore from "expo-secure-store";

/**
 * The Linework session token, kept in the Keychain (iOS) or Keystore (Android). It never goes in
 * ordinary app storage.
 */
const KEY = "linework-session";

export async function readSessionToken() {
  try {
    return (await SecureStore.getItemAsync(KEY)) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} token empty to forget it */
export async function writeSessionToken(token) {
  try {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch (error) {
    console.warn("Could not store the session securely; you'll need to sign in again next time.", error);
  }
}
