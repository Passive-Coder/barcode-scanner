import { HttpError, errorResponse } from "./http.js";
import { sendPush } from "./push.js";
import * as alertRoutes from "./routes/alerts.js";
import * as changeRoutes from "./routes/changes.js";
import * as docRoutes from "./routes/docs.js";
import * as eventRoutes from "./routes/events.js";
import * as pushRoutes from "./routes/push.js";
import * as sessionRoutes from "./routes/session.js";
import * as teamRoutes from "./routes/teams.js";
import { readSession, verifyGoogleToken } from "./session.js";

/**
 * @typedef {{
 *   DB: D1Database,
 *   GOOGLE_CLIENT_ID: string,
 *   APP_ORIGINS?: string,
 *   VAPID_PUBLIC_KEY?: string,
 *   VAPID_PRIVATE_KEY?: string,
 *   VAPID_SUBJECT?: string,
 * }} Env
 * @typedef {{
 *   verifyToken: typeof verifyGoogleToken,
 *   sendPush: typeof sendPush,
 *   now: () => number,
 * }} Services
 * @typedef {{
 *   request: Request,
 *   env: Env,
 *   db: D1Database,
 *   url: URL,
 *   params: Record<string, string>,
 *   now: number,
 *   user: import("./session.js").SessionUser,
 *   services: Services,
 *   waitUntil: (promise: Promise<unknown>) => void,
 * }} Context
 * @typedef {(context: Context) => Promise<Response>} Handler
 * @typedef {(method: string, pattern: string, handler: Handler, options?: { public?: boolean }) => void} Register
 */

const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * Changes must come from Linework's own pages. Together with the SameSite=Strict session
 * cookie and JSON-only bodies, this stops other sites from acting as a signed-in person.
 * @param {Request} request @param {URL} url @param {Env} env
 */
function checkOrigin(request, url, env) {
  const origin = request.headers.get("Origin");
  const allowed = new Set([url.origin, ...(env.APP_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean)]);
  const site = request.headers.get("Sec-Fetch-Site");
  if (!origin || !allowed.has(origin) || (site && site !== "same-origin")) throw new HttpError(403, "This request didn't come from Linework.");
}

/** @param {Partial<Services>} [overrides] for tests */
export function createApi(overrides = {}) {
  /** @type {Services} */
  const services = { verifyToken: verifyGoogleToken, sendPush, now: () => Date.now(), ...overrides };
  /** @type {Array<{ method: string, parts: string[], handler: Handler, public: boolean }>} */
  const routes = [];
  /** @type {Register} */
  const register = (method, pattern, handler, options = {}) => {
    routes.push({ method, parts: pattern.split("/").filter(Boolean), handler, public: Boolean(options.public) });
  };
  for (const module of [sessionRoutes, teamRoutes, eventRoutes, docRoutes, alertRoutes, pushRoutes, changeRoutes]) module.register(register);

  /** @param {string} method @param {string} pathname */
  function match(method, pathname) {
    const parts = pathname.split("/").filter(Boolean);
    let pathMatched = false;
    for (const route of routes) {
      if (route.parts.length !== parts.length) continue;
      /** @type {Record<string, string>} */
      const params = {};
      const fits = route.parts.every((part, index) => {
        if (part.startsWith(":")) {
          params[part.slice(1)] = decodeURIComponent(parts[index]);
          return true;
        }
        return part === parts[index];
      });
      if (!fits) continue;
      pathMatched = true;
      if (route.method === method) return { route, params };
    }
    throw new HttpError(pathMatched ? 405 : 404, pathMatched ? "That method isn't allowed here." : "Not found.");
  }

  /**
   * @param {Request} request
   * @param {Env} env
   * @param {{ waitUntil: (promise: Promise<unknown>) => void }} [ctx]
   */
  return async function handle(request, env, ctx) {
    const url = new URL(request.url);
    try {
      let found;
      try {
        found = match(request.method, url.pathname);
      } catch (error) {
        if (error instanceof URIError) throw new HttpError(400, "That address isn't valid.");
        throw error;
      }
      if (!SAFE_METHODS.has(request.method)) checkOrigin(request, url, env);
      const now = services.now();
      const user = found.route.public ? null : await readSession(env.DB, request, now);
      if (!found.route.public && !user) throw new HttpError(401, "Your Linework session has ended. Sign in again.");
      return await found.route.handler({
        request,
        env,
        db: env.DB,
        url,
        params: found.params,
        now,
        user: /** @type {import("./session.js").SessionUser} */ (user),
        services,
        waitUntil: (promise) => (ctx ? ctx.waitUntil(promise) : void promise.catch(() => {})),
      });
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error.status, error.message);
      console.error("Linework API error", error);
      return errorResponse(500, "Something went wrong on Linework's server. Try again.");
    }
  };
}
