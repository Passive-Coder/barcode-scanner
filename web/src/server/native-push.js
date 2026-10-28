/**
 * Push notifications for the iOS and Android app, sent through Expo's push service, which
 * forwards them to Apple (APNs) and Google (FCM). Unlike Web Push these aren't end-to-end
 * encrypted for the device, so they carry only what the notification shows.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/;
/** Expo accepts up to 100 messages per request. */
const BATCH = 100;

/** @param {unknown} token */
export const isExpoPushToken = (token) => typeof token === "string" && token.length <= 200 && TOKEN_PATTERN.test(token);

/**
 * @typedef {{ EXPO_ACCESS_TOKEN?: string }} NativePushEnv
 * @typedef {{ id: string, eventId: string, eventName: string, title: string, body: string, urgency: "notice" | "page", sender: string } & Record<string, string | number>} AlertMessage
 */

/**
 * Sends an alert to each device token. Returns the tokens Expo says are no longer registered
 * (the app was uninstalled, or notifications were turned off), so they can be forgotten.
 * @param {NativePushEnv} env
 * @param {string[]} tokens
 * @param {AlertMessage} message
 * @param {{ urgent: boolean, ttlSeconds: number }} options
 */
export async function sendNativePush(env, tokens, message, { urgent, ttlSeconds }) {
  /** @type {string[]} */
  const expired = [];
  for (let start = 0; start < tokens.length; start += BATCH) {
    const batch = tokens.slice(start, start + BATCH);
    const body = batch.map((to) => ({
      to,
      title: message.title,
      body: [message.body, [message.sender, message.eventName].filter(Boolean).join(" · ")].filter(Boolean).join("\n"),
      data: { type: "alert", id: message.id, eventId: message.eventId, urgency: message.urgency },
      sound: "default",
      priority: urgent ? "high" : "normal",
      // Android channels the app creates: pages are loud and pop up, notices are quieter.
      channelId: urgent ? "pages" : "alerts",
      ttl: ttlSeconds,
      ...(urgent ? { interruptionLevel: "time-sensitive" } : {}),
    }));
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.warn(`Expo push service refused alerts (${response.status}).`);
        continue;
      }
      const { data } = /** @type {{ data?: Array<{ status: string, details?: { error?: string } }> }} */ (await response.json());
      data?.forEach((ticket, index) => {
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") expired.push(batch[index]);
      });
    } catch (error) {
      console.warn("Could not send app notifications.", error);
    }
  }
  return expired;
}
