/** Request bodies larger than this are refused before they are parsed. */
const MAX_BODY_BYTES = 256 * 1024;

/** An error whose message is safe to show the person who made the request. */
export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** @param {unknown} data @param {number} [status] @param {Record<string, string>} [headers] */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...API_HEADERS, ...headers } });
}

/** @param {number} status @param {string} message */
export const errorResponse = (status, message) => json({ error: message }, status);

/**
 * Reads a JSON object body. Only `application/json` is accepted: browsers can't send that
 * cross-site without a CORS preflight, which this API never grants.
 * @param {Request} request
 * @returns {Promise<Record<string, any>>}
 */
export async function readBody(request) {
  if (!/^application\/json\b/i.test(request.headers.get("Content-Type") ?? "")) {
    throw new HttpError(415, "Send the request as JSON.");
  }
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "That request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new HttpError(413, "That request is too large.");
  let body;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "The request body must be a JSON object.");
  return body;
}

/** @param {string | null} header @param {string} name */
export function readCookie(header, name) {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return "";
}
