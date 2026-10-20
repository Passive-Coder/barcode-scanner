import { HttpError, json, readBody } from "../http.js";
import { pushConfigured } from "../push.js";
import { closeSession, openSession, sessionCookie, sessionToken } from "../session.js";

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Exchanges a Google access token (already held by the browser) for a Linework session.
  route(
    "POST",
    "/api/session",
    async ({ request, env, db, now, services }) => {
      const body = await readBody(request);
      const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
      if (!accessToken || accessToken.length > 4096) throw new HttpError(400, "Sign in with Google first.");
      if (!env.GOOGLE_CLIENT_ID) throw new HttpError(503, "Linework's server isn't configured for Google sign-in.");
      const identity = await services.verifyToken(accessToken, env.GOOGLE_CLIENT_ID);
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
