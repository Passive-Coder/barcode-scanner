import { afterEach, describe, expect, it, vi } from "vitest";
import { SheetsAuthError, SheetsClient, SheetsPermissionError, permissionError } from "./sheets-client.js";

/** @param {() => void} [onUnauthorized] */
const client = (onUnauthorized = () => {}) => new SheetsClient({ getToken: () => "test-token", onUnauthorized });

/** Stubs fetch with a Google API error response. @param {number} status @param {string} message */
function respondWith(status, message) {
  const body = JSON.stringify({ error: { code: status, message, status: "PERMISSION_DENIED" } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, headers: { "Content-Type": "application/json" } })));
}

/** @param {Promise<unknown>} promise */
const failure = (promise) => promise.then(() => { throw new Error("Expected the request to fail"); }, (error) => error);

afterEach(() => vi.unstubAllGlobals());

describe("Sheets permission errors", () => {
  it("explains an edit Google refused as view-only access, not Google's raw text", async () => {
    respondWith(403, "The caller does not have permission");
    const error = await failure(client().appendColumn("sheet-id", 0));
    expect(error).toBeInstanceOf(SheetsPermissionError);
    expect(error.access).toBe("view-only");
    expect(error.message).toMatch(/can only view this spreadsheet/);
    expect(error.message).toMatch(/Sign in as the owner/);
    expect(error.message).not.toMatch(/caller/i);
  });

  it("explains a read Google refused as no access", async () => {
    respondWith(403, "The caller does not have permission");
    const error = await failure(client().getSpreadsheet("sheet-id"));
    expect(error).toBeInstanceOf(SheetsPermissionError);
    expect(error.access).toBe("no-access");
    expect(error.message).toMatch(/can't open this spreadsheet/);
    expect(error.message).toMatch(/account that owns it/);
  });

  it("asks to sign in again when the token lacks the Sheets permission", () => {
    const error = permissionError("Request had insufficient authentication scopes.", "POST");
    expect(error).not.toBeInstanceOf(SheetsPermissionError);
    expect(error.message).toMatch(/sign in again/);
  });

  it("explains protected ranges", () => {
    const error = permissionError("You are trying to edit a protected cell or object.", "POST");
    expect(error.message).toMatch(/protected/);
  });

  it("expires the session on 401", async () => {
    respondWith(401, "Request had invalid authentication credentials.");
    const onUnauthorized = vi.fn();
    const error = await failure(client(onUnauthorized).getSpreadsheet("sheet-id"));
    expect(error).toBeInstanceOf(SheetsAuthError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
