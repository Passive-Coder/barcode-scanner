/**
 * Splits an http(s) URL into the parts Linework uses. React Native's built-in `URL` doesn't
 * implement `hostname`, `pathname`, or `searchParams`, so the app doesn't rely on it.
 *
 * @typedef {{ href: string, host: string, path: string, search: string, params: Array<[string, string]> }} HttpUrl
 */

const HTTP_URL = /^(https?):\/\/(?:[^@/?#\s]*@)?([^/?#:\s]+)(:\d+)?([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;

/** Decodes a query component the way URLSearchParams does (`+` is a space). @param {string} text */
function decodeQuery(text) {
  const spaced = text.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/**
 * @param {string} text
 * @returns {HttpUrl | null} null if it isn't an http(s) URL
 */
export function parseHttpUrl(text) {
  const match = text.trim().match(HTTP_URL);
  if (!match) return null;
  const [, scheme, hostname, port = "", rawPath, search = "", hash = ""] = match;
  const host = hostname.toLowerCase();
  const path = rawPath || "/";
  /** @type {Array<[string, string]>} */
  const params = search
    .slice(1)
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf("=");
      return index < 0 ? [decodeQuery(pair), ""] : [decodeQuery(pair.slice(0, index)), decodeQuery(pair.slice(index + 1))];
    });
  return { href: `${scheme.toLowerCase()}://${host}${port}${path}${search}${hash}`, host, path, search, params };
}
