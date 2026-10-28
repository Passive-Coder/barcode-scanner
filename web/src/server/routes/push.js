import { HttpError, json, readBody } from "../http.js";
import { isExpoPushToken } from "../native-push.js";
import { isPushEndpoint } from "../push.js";

/** Older devices beyond this many are forgotten, newest kept. */
const MAX_DEVICES = 10;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

/** @param {Record<string, any>} body */
function endpointFrom(body) {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (endpoint.length > 1000 || !isPushEndpoint(endpoint)) throw new HttpError(400, "That isn't a browser push address Linework can use.");
  return endpoint;
}

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Registers this device for alerts. A device belongs to whoever signed in on it last.
  route("POST", "/api/push/subscriptions", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const endpoint = endpointFrom(body);
    const p256dh = String(body.keys?.p256dh ?? "");
    const auth = String(body.keys?.auth ?? "");
    if (!KEY_PATTERN.test(p256dh) || !KEY_PATTERN.test(auth)) throw new HttpError(400, "The browser's push keys are missing.");
    await db.batch([
      db
        .prepare(
          `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
        )
        .bind(endpoint, user.id, p256dh, auth, now),
      db
        .prepare(
          `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
             (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2)`,
        )
        .bind(user.id, MAX_DEVICES),
    ]);
    return json({ ok: true }, 201);
  });

  route("POST", "/api/push/subscriptions/remove", async ({ request, db, user }) => {
    const body = await readBody(request);
    await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id = ?2").bind(endpointFrom(body), user.id).run();
    return json({ ok: true });
  });

  // Registers a phone running the app for alerts, by its Expo push token.
  route("POST", "/api/push/native", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    if (!isExpoPushToken(body.token)) throw new HttpError(400, "That isn't an app notification token Linework can use.");
    const platform = body.platform === "ios" || body.platform === "android" ? body.platform : null;
    if (!platform) throw new HttpError(400, "Platform must be ios or android.");
    await db.batch([
      db
        .prepare(
          `INSERT INTO native_push_tokens (token, user_id, platform, created_at) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, created_at = excluded.created_at`,
        )
        .bind(body.token, user.id, platform, now),
      db
        .prepare(
          `DELETE FROM native_push_tokens WHERE user_id = ?1 AND token NOT IN
             (SELECT token FROM native_push_tokens WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2)`,
        )
        .bind(user.id, MAX_DEVICES),
    ]);
    return json({ ok: true }, 201);
  });

  route("POST", "/api/push/native/remove", async ({ request, db, user }) => {
    const body = await readBody(request);
    if (!isExpoPushToken(body.token)) throw new HttpError(400, "That isn't an app notification token Linework can use.");
    await db.prepare("DELETE FROM native_push_tokens WHERE token = ?1 AND user_id = ?2").bind(body.token, user.id).run();
    return json({ ok: true });
  });
}
