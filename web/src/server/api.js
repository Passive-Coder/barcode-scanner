import { HttpError, errorResponse } from "./http.js";
import { sendNativePush } from "./native-push.js";
import { sendPush } from "./push.js";
import * as alertRoutes from "./routes/alerts.js";
import * as changeRoutes from "./routes/changes.js";
import * as docRoutes from "./routes/docs.js";
import * as eventRoutes from "./routes/events.js";
import * as pushRoutes from "./routes/push.js";
import * as sessionRoutes from "./routes/session.js";
import * as teamRoutes from "./routes/teams.js";
import { bearerToken, cookieToken, readSession, verifyGoogleToken } from "./session.js";

/**
 * @typedef {{
 *   DB: D1Database,
 *   GOOGLE_CLIENT_ID: string,
 *   GOOGLE_CLIENT_IDS?: string,
 *   APP_ORIGINS?: string,
 *   VAPID_PUBLIC_KEY?: string,
 *   VAPID_PRIVATE_KEY?: string,
 *   VAPID_SUBJECT?: string,
 *   EXPO_ACCESS_TOKEN?: string,
 * }} Env
 * @typedef {{
 *   verifyToken: typeof verifyGoogleToken,
 *   sendPush: typeof sendPush,
 *   sendNativePush: typeof sendNativePush,
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
const NOT_LINEWORK = "This request didn't come from Linework.";

/** @param {URL} url @param {Env} env */
const allowedOrigins = (url, env) => new Set([url.origin, ...(env.APP_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean)]);

/**
 * Changes must come from Linework's own pages or app. Browsers send an Origin header with every
 * request that changes something: it must be one of Linework's, and a request riding on the
 * website's SameSite=Strict session cookie must also be same-origin. The mobile app sends no
 * Origin and authenticates with a bearer token, which browsers never attach on their own.
 * @param {Request} request @param {URL} url @param {Env} env
 */
function checkOrigin(request, url, env) {
  const origin = request.headers.get("Origin");
  const bearer = bearerToken(request) !== null;
  if (!origin) {
    if (!bearer && cookieToken(request)) throw new HttpError(403, NOT_LINEWORK);
    return;
  }
  if (!allowedOrigins(url, env).has(origin)) throw new HttpError(403, NOT_LINEWORK);
  const site = request.headers.get("Sec-Fetch-Site");
  if (!bearer && site && site !== "same-origin") throw new HttpError(403, NOT_LINEWORK);
}

/**
 * Lets Linework's other origins (such as the app's web build in development) call the API with
 * a bearer token. Cookies are never allowed cross-origin.
 * @param {Request} request @param {URL} url @param {Env} env
 * @returns {Record<string, string> | null}
 */
function corsHeaders(request, url, env) {
  const origin = request.headers.get("Origin");
  if (!origin || origin === url.origin || !allowedOrigins(url, env).has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

/** @param {Partial<Services>} [overrides] for tests */
export function createApi(overrides = {}) {
  /** @type {Services} */
  const services = { verifyToken: verifyGoogleToken, sendPush, sendNativePush, now: () => Date.now(), ...overrides };
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
    const cors = corsHeaders(request, url, env);
    if (request.method === "OPTIONS") {
      if (!cors) return errorResponse(403, NOT_LINEWORK);
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
        },
      });
    }
    const response = await respond(request, env, ctx, url);
    if (cors) for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  };

  /**
   * @param {Request} request
   * @param {Env} env
   * @param {{ waitUntil: (promise: Promise<unknown>) => void } | undefined} ctx
   * @param {URL} url
   */
  async function respond(request, env, ctx, url) {
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
  }
}
