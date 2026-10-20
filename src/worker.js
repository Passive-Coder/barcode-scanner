const LEGACY_HOST = "linework-barcode-scanner.passiveuser369.workers.dev";
const HOME_HOST = "linework.stucovitv.in";

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   */
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === LEGACY_HOST) {
      url.hostname = HOME_HOST;
      return Response.redirect(url, 308);
    }
    return env.ASSETS.fetch(request);
  },
};
