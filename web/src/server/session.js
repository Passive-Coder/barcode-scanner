import { HttpError, readCookie } from "./http.js";

/** Browser sessions last a working day; signing in again starts a new one. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
/**
 * The mobile app keeps its session token in the device's secure storage (Keychain or Keystore)
 * and sends it as `Authorization: Bearer …`, so it can stay signed in longer.
 */
export const APP_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BEARER = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/;
const SECURE_COOKIE = "__Host-linework_session";
/** Plain-HTTP localhost can't hold a `__Host-` (Secure) cookie in every browser. */
const LOCAL_COOKIE = "linework_session";
const GOOGLE_TIMEOUT_MS = 10_000;

/** @typedef {{ id: string, email: string, name: string }} SessionUser */

/** @param {URL} url */
const cookieName = (url) => (url.protocol === "https:" ? SECURE_COOKIE : LOCAL_COOKIE);

/** @param {Uint8Array} bytes */
const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** @param {string} token */
async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64url(new Uint8Array(digest));
}

/**
 * Asks Google who an access token belongs to. The token must have been issued to one of
 * Linework's own OAuth clients (the website's, or the iOS and Android app's): a token another app
 * obtained must never sign anyone in here.
 * @param {string} accessToken
 * @param {string[]} clientIds
 * @returns {Promise<{ sub: string, email: string, name: string }>}
 */
export async function verifyGoogleToken(accessToken, clientIds) {
  /** @param {Response} response */
  const parse = async (response) => (response.ok ? response.json() : null);
  let info;
  let profile;
  try {
    // POST keeps the token out of URLs (and so out of any request logs).
    [info, profile] = await Promise.all([
      fetch("https://oauth2.googleapis.com/tokeninfo", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }),
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      }).then(parse),
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      })
        .then(parse)
        .catch(() => null),
    ]);
  } catch {
    throw new HttpError(503, "Google couldn't confirm your sign-in right now. Try again in a moment.");
  }
  if (!info) throw new HttpError(401, "Google didn't accept this sign-in. Sign in again.");
  if (!clientIds.includes(info.aud) && !clientIds.includes(info.azp)) throw new HttpError(401, "This sign-in was issued to a different app.");
  if (!(Number(info.expires_in) > 0)) throw new HttpError(401, "This Google sign-in has expired. Sign in again.");
  if (!info.sub || !info.email) throw new HttpError(401, "Allow Linework to see your email address when you sign in.");
  if (info.email_verified !== true && info.email_verified !== "true") throw new HttpError(403, "Your Google account's email address isn't verified.");
  // The profile is only for display; identity comes from tokeninfo.
  const name = profile?.sub === info.sub ? String(profile.given_name || profile.name || "").slice(0, 120) : "";
  return { sub: String(info.sub), email: String(info.email).toLowerCase(), name };
}

/**
 * Creates or updates the person's account and opens a session for them.
 * @param {D1Database} db
 * @param {{ sub: string, email: string, name: string }} identity
 * @param {number} now
 * @param {string} [replacing] the previous session's token, which is ended
 * @param {number} [ttl] how long the session lasts
 * @returns {Promise<{ token: string, user: SessionUser, expiresAt: number }>}
 */
export async function openSession(db, identity, now, replacing = "", ttl = SESSION_TTL_MS) {
  // A Google account's email can change, so match on the stable subject first.
  const existing = await db.prepare("SELECT id FROM users WHERE google_sub = ?1 OR email = ?2 ORDER BY google_sub = ?1 DESC LIMIT 1").bind(identity.sub, identity.email).first();
  const userId = /** @type {string | undefined} */ (existing?.id) ?? crypto.randomUUID();
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const statements = [
    existing
      ? db.prepare("UPDATE users SET email = ?2, google_sub = ?3, name = CASE WHEN ?4 = '' THEN name ELSE ?4 END, last_seen_at = ?5 WHERE id = ?1")
          .bind(userId, identity.email, identity.sub, identity.name, now)
      : db.prepare("INSERT INTO users (id, email, name, google_sub, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)")
          .bind(userId, identity.email, identity.name, identity.sub, now),
    db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(await hashToken(token), userId, now, now + ttl),
    // Housekeeping: expired sessions are never valid, so they can go.
    db.prepare("DELETE FROM sessions WHERE user_id = ?1 AND expires_at <= ?2").bind(userId, now),
  ];
  if (replacing) statements.push(db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await hashToken(replacing)));
  await db.batch(statements);
  const user = await db.prepare("SELECT id, email, name FROM users WHERE id = ?1").bind(userId).first();
  return { token, user: /** @type {SessionUser} */ (user), expiresAt: now + ttl };
}

/** @param {Request} request */
export function sessionToken(request) {
  const bearer = bearerToken(request);
  if (bearer !== null) return bearer;
  return cookieToken(request);
}

/** The website's session cookie, "" if there is none. @param {Request} request */
export function cookieToken(request) {
  return readCookie(request.headers.get("Cookie"), cookieName(new URL(request.url)));
}

/**
 * The session token the mobile app sends, "" if the header is malformed, null if there is none.
 * @param {Request} request
 */
export function bearerToken(request) {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  return header.match(BEARER)?.[1] ?? "";
}

/**
 * @param {D1Database} db
 * @param {Request} request
 * @param {number} now
 * @returns {Promise<SessionUser | null>}
 */
export async function readSession(db, request, now) {
  const token = sessionToken(request);
  if (!token || token.length > 100) return null;
  const user = await db
    .prepare("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1 AND s.expires_at > ?2")
    .bind(await hashToken(token), now)
    .first();
  return /** @type {SessionUser | null} */ (user);
}

/** @param {D1Database} db @param {Request} request */
export async function closeSession(db, request) {
  const token = sessionToken(request);
  if (token && token.length <= 100) await db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await hashToken(token)).run();
}

/** @param {Request} request @param {string} token empty to clear the cookie */
export function sessionCookie(request, token) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const age = token ? Math.floor(SESSION_TTL_MS / 1000) : 0;
  return `${cookieName(url)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}
