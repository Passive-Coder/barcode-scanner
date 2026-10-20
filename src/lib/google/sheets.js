import { auth } from "../stores/auth.svelte.js";
import { DriveClient } from "./drive-client.js";
import { SheetsClient } from "./sheets-client.js";

/** The signed-in person's Google API clients, shared by every store. */
const credentials = { getToken: () => auth.token(), onUnauthorized: () => auth.expire() };

export const sheets = new SheetsClient(credentials);
export const drive = new DriveClient(credentials);
