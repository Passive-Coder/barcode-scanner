import { HttpError, json, readBody } from "../http.js";
import { pushConfigured } from "../push.js";
import { APP_SESSION_TTL_MS, closeSession, openSession, sessionCookie, sessionToken } from "../session.js";

/** @param {import("../api.js").Env} env */
export const googleClientIds = (env) =>
  [env.GOOGLE_CLIENT_ID, ...(env.GOOGLE_CLIENT_IDS ?? "").split(",")].map((id) => (id ?? "").trim()).filter(Boolean);

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Exchanges a Google access token (already held by the browser or app) for a Linework session.
  // The website gets an HttpOnly cookie; the mobile app asks for a bearer token instead
  // (`tokenType: "bearer"`), which it keeps in the device's secure storage.
  route(
    "POST",
    "/api/session",
    async ({ request, env, db, now, services }) => {
      const body = await readBody(request);
      const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
      const bearer = body.tokenType === "bearer";
      if (!accessToken || accessToken.length > 4096) throw new HttpError(400, "Sign in with Google first.");
      const clientIds = googleClientIds(env);
      if (!clientIds.length) throw new HttpError(503, "Linework's server isn't configured for Google sign-in.");
      const identity = await services.verifyToken(accessToken, clientIds);
      if (bearer) {
        const { token, user, expiresAt } = await openSession(db, identity, now, "", APP_SESSION_TTL_MS);
        return json({ user, token, expiresAt, vapidPublicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : "" });
      }
      const { token, user } = await openSession(db, identity, now, sessionToken(request));
      return json(
        { user, vapidPublicKey: pushConfigured(env) ? env.VAPID_PUBLIC_KEY : "" },
        200,
        { "Set-Cookie": sessionCookie(request, token) },
      );
    },
    { public: true },
  );

  route("GET", "/api/session", async ({ user }) => json({ user }));

  route(
    "DELETE",
    "/api/session",
    async ({ request, db }) => {
      await closeSession(db, request);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, "") });
    },
    { public: true },
  );
}
