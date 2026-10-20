import { createApi } from "./server/api.js";

const LEGACY_HOST = "linework-barcode-scanner.passiveuser369.workers.dev";
const HOME_HOST = "linework.stucovitv.in";

const api = createApi();

export default {
  /**
   * @param {Request} request
   * @param {import("./server/api.js").Env & { ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   * @param {{ waitUntil: (promise: Promise<unknown>) => void }} ctx
   */
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) {
      url.hostname = HOME_HOST;
      return Response.redirect(url, 308);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return api(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
