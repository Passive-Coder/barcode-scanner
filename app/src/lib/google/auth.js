import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { config } from "../config.js";

/**
 * Google sign-in on iOS and Android, through Google's own SDKs. The web build uses
 * auth.web.js instead; both export the same functions.
 *
 * @typedef {{ email: string, name: string, scopes: string[] }} GoogleAccount
 */

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/** Email and basic profile come with every Google sign-in; Sheets is asked for on top. */
const SIGN_IN_SCOPES = [SHEETS_SCOPE];

let configured = false;

/** Why Google sign-in can't work in this build, or "" if it can. */
export function configurationProblem() {
  if (Platform.OS === "ios" && !config.googleIosClientId) return "Google sign-in isn't set up for iPhone and iPad yet (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is missing).";
  if (Platform.OS === "android" && !config.googleWebClientId) return "Google sign-in isn't set up for Android yet (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing).";
  // The Android SDK resolves this OAuth client from the package name and signing certificate.
  if (Platform.OS === "android" && !config.googleAndroidClientId) return "Google sign-in isn't set up for Android yet (EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is missing).";
  return "";
}

function configure() {
  if (configured) return;
  const problem = configurationProblem();
  if (problem) throw new Error(problem);
  GoogleSignin.configure({
    scopes: SIGN_IN_SCOPES,
    webClientId: config.googleWebClientId || undefined,
    iosClientId: config.googleIosClientId || undefined,
    offlineAccess: false,
  });
  configured = true;
}

/** @param {import("@react-native-google-signin/google-signin").User} user @returns {GoogleAccount} */
const toAccount = (user) => ({ email: user.user.email, name: user.user.givenName || user.user.name || "", scopes: user.scopes ?? [] });

/** Turns the SDK's error codes into something a person can act on. @param {unknown} error */
function describe(error) {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return new Error("Google sign-in was cancelled.");
    if (error.code === statusCodes.IN_PROGRESS) return new Error("Google sign-in is already open.");
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new Error("Google Play services aren't available or need an update on this device.");
    if (error.code === "10" || /DEVELOPER_ERROR/.test(error.message)) {
      return new Error("Google sign-in isn't set up for this build of the app. Check its Android OAuth client (package name and signing certificate).");
    }
  }
  return error instanceof Error ? error : new Error("Google sign-in failed.");
}

/**
 * Shows Google's account chooser and asks for Sheets access.
 * @param {{ loginHint?: string }} [options]
 * @returns {Promise<GoogleAccount>}
 */
export async function signIn({ loginHint } = {}) {
  configure();
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn(loginHint ? { loginHint } : undefined);
    if (!isSuccessResponse(response)) throw new Error("Google sign-in was cancelled.");
    let user = response.data;
    if (!user.scopes.includes(SHEETS_SCOPE)) {
      const added = await GoogleSignin.addScopes({ scopes: [SHEETS_SCOPE] });
      if (!added || !isSuccessResponse(added) || !added.data.scopes.includes(SHEETS_SCOPE)) {
        throw new Error("Google Sheets access was not granted. Sign in again and allow access to your spreadsheets.");
      }
      user = added.data;
    }
    return toAccount(user);
  } catch (error) {
    throw describe(error);
  }
}

/** Signs back in without asking, if this device signed in before. @returns {Promise<GoogleAccount | null>} */
export async function restore() {
  if (configurationProblem()) return null;
  configure();
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const response = await GoogleSignin.signInSilently();
    return response.type === "success" ? toAccount(response.data) : null;
  } catch {
    return null;
  }
}

/** A current access token. The SDK refreshes it when it has expired. */
export async function getAccessToken() {
  configure();
  try {
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (error) {
    throw describe(error);
  }
}

/**
 * Google refused a token. On Android the SDK may have handed out a cached token that has
 * expired, so it's dropped and another one can be tried.
 * @param {string} token
 * @returns {Promise<boolean>} whether a fresh token may now be available
 */
export async function refresh(token) {
  if (Platform.OS !== "android") return false;
  try {
    await GoogleSignin.clearCachedAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Asks for one more permission (such as Google Drive), keeping those already granted.
 * @param {string} scope
 * @returns {Promise<string[]>} every scope granted afterwards
 */
export async function grant(scope) {
  configure();
  try {
    const response = await GoogleSignin.addScopes({ scopes: [scope] });
    if (!response || !isSuccessResponse(response) || !response.data.scopes.includes(scope)) {
      throw new Error("That permission wasn't granted. Try again and allow it in Google's window.");
    }
    return response.data.scopes;
  } catch (error) {
    throw describe(error);
  }
}

export async function signOut() {
  if (!configured) return;
  await GoogleSignin.signOut().catch(() => {});
}
