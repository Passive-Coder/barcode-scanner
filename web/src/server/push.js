import { buildPushPayload } from "@block65/webcrypto-web-push";

/**
 * Browser push services. Subscriptions must point at one of these, so the server can never be
 * used to send requests to arbitrary URLs.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

/** @param {string} endpoint */
export function isPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

/**
 * @typedef {{ endpoint: string, p256dh: string, auth: string }} StoredSubscription
 * @typedef {{ VAPID_PUBLIC_KEY?: string, VAPID_PRIVATE_KEY?: string, VAPID_SUBJECT?: string }} PushEnv
 */

/** @param {PushEnv} env */
export const pushConfigured = (env) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);

/**
 * Sends one encrypted message to each subscription. Returns the endpoints the push service
 * says are gone, so they can be forgotten.
 * @param {PushEnv} env
 * @param {StoredSubscription[]} subscriptions
 * @param {Record<string, string | number | boolean | null>} message
 * @param {{ urgent: boolean, ttlSeconds: number }} options
 */
export async function sendPush(env, subscriptions, message, { urgent, ttlSeconds }) {
  if (!pushConfigured(env) || !subscriptions.length) return [];
  const vapid = {
    subject: /** @type {string} */ (env.VAPID_SUBJECT),
    publicKey: /** @type {string} */ (env.VAPID_PUBLIC_KEY),
    privateKey: /** @type {string} */ (env.VAPID_PRIVATE_KEY),
  };
  /** @type {string[]} */
  const expired = [];
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const payload = await buildPushPayload(
          { data: message, options: { ttl: ttlSeconds, urgency: urgent ? "high" : "normal" } },
          { endpoint: subscription.endpoint, expirationTime: null, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          vapid,
        );
        const response = await fetch(subscription.endpoint, { ...payload, signal: AbortSignal.timeout(10_000) });
        if (response.status === 404 || response.status === 410) expired.push(subscription.endpoint);
        else if (!response.ok) console.warn(`Push service refused a message (${response.status}).`);
      } catch (error) {
        console.warn("Could not send a push message.", error);
      }
    }),
  );
  return expired;
}
