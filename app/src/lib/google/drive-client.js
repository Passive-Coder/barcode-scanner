import { fetchWithTimeout, isTimeout } from "../net.js";
import { parseHttpUrl } from "../url.js";
import { GoogleUnavailableError, SheetsAuthError } from "./sheets-client.js";

const API = "https://www.googleapis.com/drive/v3/files";
const REQUEST_TIMEOUT_MS = 30_000;

/** Lets Linework create files and manage the files it created, and nothing else in Drive. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const MIME_TYPES = {
  sheet: "application/vnd.google-apps.spreadsheet",
  doc: "application/vnd.google-apps.document",
};

/** The signed-in account hasn't let Linework use Google Drive yet. */
export class DriveScopeError extends Error {
  name = "DriveScopeError";
}

/** The file or permission no longer exists (or this account can't see it). */
export class DriveNotFoundError extends Error {
  name = "DriveNotFoundError";
}

/** @param {"sheet" | "doc"} kind @param {string} fileId */
export const fileUrl = (kind, fileId) =>
  kind === "sheet" ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/edit` : `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/edit`;

/**
 * Reads a Google Sheets or Docs link (or a bare file ID).
 * @param {string} input
 * @returns {{ kind: "sheet" | "doc" | null, fileId: string }}
 */
export function parseFileLink(input) {
  const value = input.trim();
  const url = parseHttpUrl(value);
  const match = url?.host === "docs.google.com" ? url.path.match(/^\/(spreadsheets|document)(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]{20,})/) : null;
  if (match) return { kind: match[1] === "spreadsheets" ? "sheet" : "doc", fileId: match[2] };
  if (/^[A-Za-z0-9_-]{20,128}$/.test(value)) return { kind: null, fileId: value };
  throw new Error("Paste a Google Sheets or Google Docs link.");
}

/**
 * Google Drive REST client for the files Linework creates for events: creating them and
 * sharing them with the event's people. With the drive.file scope it can't see anything else.
 */
export class DriveClient {
  /** @param {import("./sheets-client.js").GoogleCredentials} auth */
  constructor({ getToken, onUnauthorized }) {
    this.getToken = getToken;
    this.onUnauthorized = onUnauthorized;
  }

  /** @param {string} url @param {{ method?: string, body?: unknown }} [options] */
  async request(url, { method = "GET", body } = {}) {
    let response;
    for (let attempt = 0; ; attempt++) {
      const token = await this.getToken();
      try {
        response = await fetchWithTimeout(
          url,
          {
            method,
            headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
          },
          REQUEST_TIMEOUT_MS,
        );
      } catch (error) {
        if (isTimeout(error)) throw new GoogleUnavailableError("Google Drive took too long to respond. Try again.");
        throw new GoogleUnavailableError("Could not reach Google Drive. Check your connection and try again.");
      }
      if (response.status !== 401) break;
      if (attempt > 0 || !(await this.onUnauthorized(token))) throw new SheetsAuthError("Your Google session expired. Reconnect Google to continue.");
    }
    if (response.ok) return response.status === 204 ? {} : response.json();

    let detail = "";
    let reason = "";
    try {
      const failure = (await response.json()).error;
      detail = failure?.message ?? "";
      reason = failure?.errors?.[0]?.reason ?? "";
    } catch {
      /* The status code is enough. */
    }
    if (response.status === 403 && /insufficient.*scope/i.test(detail + reason)) {
      throw new DriveScopeError("Linework needs permission to create and share files in your Google Drive.");
    }
    if (response.status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(detail + reason)) {
      throw new Error("The Google Drive API isn't enabled for this app's Google Cloud project.");
    }
    if (response.status === 403 && /rateLimit|userRateLimitExceeded|sharingRateLimitExceeded/i.test(reason)) {
      throw new GoogleUnavailableError("Google Drive is limiting how fast files can be shared. Try again in a minute.");
    }
    if (response.status === 404) throw new DriveNotFoundError(detail || "That Google Drive file couldn't be found.");
    if (response.status === 429 || response.status >= 500) throw new GoogleUnavailableError("Google Drive is having trouble right now. Try again in a moment.");
    // Google's text for sharing failures (such as an address with no Google account) is specific enough to show.
    throw new Error(detail.replace(/^Bad Request\.\s*User message:\s*/i, "").replace(/^"|"$/g, "") || `Google Drive request failed (${response.status}).`);
  }

  /**
   * Creates an empty Google Sheet or Doc in the signed-in person's Drive.
   * @param {"sheet" | "doc"} kind @param {string} title
   * @returns {Promise<{ id: string, name: string }>}
   */
  createFile(kind, title) {
    return this.request(`${API}?fields=id,name`, { method: "POST", body: { name: title, mimeType: MIME_TYPES[kind] } });
  }

  /**
   * Shares a file with one person. Google emails them a link to it.
   * @param {string} fileId @param {string} email @param {"writer" | "reader"} role
   * @returns {Promise<string>} the permission's ID
   */
  async share(fileId, email, role) {
    const result = await this.request(`${API}/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true&fields=id`, {
      method: "POST",
      body: { type: "user", role, emailAddress: email },
    });
    return result.id;
  }

  /** @param {string} fileId @param {string} permissionId @param {"writer" | "reader"} role */
  updatePermission(fileId, permissionId, role) {
    return this.request(`${API}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}?fields=id`, { method: "PATCH", body: { role } });
  }

  /** @param {string} fileId @param {string} permissionId */
  revoke(fileId, permissionId) {
    return this.request(`${API}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}`, { method: "DELETE" });
  }
}
