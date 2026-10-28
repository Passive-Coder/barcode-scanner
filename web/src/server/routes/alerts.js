import { all, loadActor, loadSubteamMembers } from "../db.js";
import { HttpError, json, readBody } from "../http.js";
import { alertRefusal, isOrganizer } from "../rbac.js";
import * as valid from "../validate.js";

const INBOX_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A sender can send this many alerts per minute, so a stuck button can't flood people. */
const ALERTS_PER_MINUTE = 10;
const MAX_RECIPIENTS = 2000;

/** @typedef {import("../rbac.js").AlertAudience} AlertAudience */

/** @param {unknown} value @returns {AlertAudience} */
function audienceFrom(value) {
  const audience = /** @type {Record<string, unknown>} */ (value && typeof value === "object" ? value : {});
  const type = valid.oneOf(audience.type, /** @type {const} */ (["everyone", "subteams", "people"]), "Audience");
  if (type === "everyone") return { type };
  if (type === "subteams") {
    const subteamIds = valid.ids(audience.subteamIds, 100, "Sub-team");
    if (!subteamIds.length) throw new HttpError(400, "Choose at least one sub-team.");
    return { type, subteamIds };
  }
  const emails = valid.emails(audience.emails, MAX_RECIPIENTS);
  if (!emails.length) throw new HttpError(400, "Choose at least one person.");
  return { type, emails };
}

/** @param {any} row */
const alertView = (row) => ({
  id: row.id,
  eventId: row.event_id,
  eventName: row.event_name,
  senderEmail: row.sender_email,
  senderName: row.sender_name,
  title: row.title,
  body: row.body,
  urgency: row.urgency,
  audienceLabel: row.audience_label,
  createdAt: row.created_at,
  ...(row.acknowledged_at !== undefined ? { acknowledgedAt: row.acknowledged_at } : {}),
  ...(row.recipient_count !== undefined ? { recipientCount: row.recipient_count, acknowledgedCount: row.acknowledged_count } : {}),
});

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Organizers alert anyone in the event; managers alert the sub-teams they manage. A "page"
  // takes over the recipients' screens until they acknowledge it.
  route("POST", "/api/events/:eventId/alerts", async ({ request, db, env, user, params, now, services, waitUntil }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const body = await readBody(request);
    const title = valid.text(body.title, { label: "Alert title", max: 120 });
    const message = valid.text(body.body, { label: "Message", max: 1000, min: 0, multiline: true });
    const urgency = valid.oneOf(body.urgency, /** @type {const} */ (["notice", "page"]), "Urgency");
    const audience = audienceFrom(body.audience);

    const { membersOf } = await loadSubteamMembers(db, event.id);
    const refusal = alertRefusal(actor, audience, membersOf);
    if (refusal) throw new HttpError(403, refusal);

    const recent = /** @type {number} */ (
      await db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE sender_email = ?1 AND created_at > ?2").bind(user.email, now - 60_000).first("n")
    );
    if (recent >= ALERTS_PER_MINUTE) throw new HttpError(429, "You've sent a lot of alerts in the last minute. Wait a moment before sending another.");

    const members = await all(db, "SELECT email FROM event_members WHERE event_id = ?1", event.id);
    const inEvent = new Set(members.map((row) => row.email));
    /** @type {string} */
    let audienceLabel;
    /** @type {Set<string>} */
    let recipients;
    if (audience.type === "everyone") {
      recipients = inEvent;
      audienceLabel = "Everyone";
    } else if (audience.type === "subteams") {
      const subteams = await all(db, "SELECT id, name FROM subteams WHERE event_id = ?1 AND id IN (SELECT value FROM json_each(?2))", event.id, JSON.stringify(audience.subteamIds));
      if (subteams.length !== audience.subteamIds.length) throw new HttpError(400, "One of those sub-teams isn't part of this event.");
      recipients = membersOf(audience.subteamIds);
      audienceLabel = subteams.map((subteam) => subteam.name).join(", ");
    } else {
      const outsider = audience.emails.find((email) => !inEvent.has(email));
      if (outsider) throw new HttpError(400, `${outsider} isn't in this event.`);
      recipients = new Set(audience.emails);
      audienceLabel = audience.emails.length === 1 ? audience.emails[0] : `${audience.emails.length} people`;
    }
    recipients.delete(user.email);
    if (!recipients.size) throw new HttpError(400, "There's no one else in that audience to alert.");

    const id = crypto.randomUUID();
    const emails = JSON.stringify([...recipients]);
    await db.batch([
      db
        .prepare("INSERT INTO alerts (id, event_id, sender_email, sender_name, title, body, urgency, audience_label, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
        .bind(id, event.id, user.email, user.name, title, message, urgency, audienceLabel.slice(0, 200), now),
      db.prepare("INSERT INTO alert_recipients (alert_id, email) SELECT ?1, value FROM json_each(?2)").bind(id, emails),
    ]);

    // Deliver to every device the recipients turned notifications on for. Sending continues
    // after the response, so the sender isn't kept waiting.
    const subscriptions = /** @type {Array<{ endpoint: string, p256dh: string, auth: string }>} */ (
      await all(db, "SELECT p.endpoint, p.p256dh, p.auth FROM push_subscriptions p JOIN users u ON u.id = p.user_id WHERE u.email IN (SELECT value FROM json_each(?1))", emails)
    );
    const appTokens = (await all(db, "SELECT n.token FROM native_push_tokens n JOIN users u ON u.id = n.user_id WHERE u.email IN (SELECT value FROM json_each(?1))", emails)).map((row) => String(row.token));
    const push = {
      type: "alert",
      id,
      eventId: event.id,
      eventName: event.name.slice(0, 120),
      title,
      body: message.slice(0, 400),
      urgency,
      sender: user.name || user.email,
      createdAt: now,
    };
    const delivery = { urgent: urgency === "page", ttlSeconds: urgency === "page" ? 3600 : 12 * 3600 };
    waitUntil(
      services
        .sendPush(env, subscriptions, push, delivery)
        .then((expired) => (expired.length ? db.prepare("DELETE FROM push_subscriptions WHERE endpoint IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(expired)).run() : null))
        .catch((error) => console.warn("Alert push delivery failed.", error)),
    );
    if (appTokens.length) {
      waitUntil(
        services
          .sendNativePush(env, appTokens, push, delivery)
          .then((expired) => (expired.length ? db.prepare("DELETE FROM native_push_tokens WHERE token IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(expired)).run() : null))
          .catch((error) => console.warn("App alert delivery failed.", error)),
      );
    }

    const devices = subscriptions.length + appTokens.length;
    return json({ alert: { ...alertView({ id, event_id: event.id, event_name: event.name, sender_email: user.email, sender_name: user.name, title, body: message, urgency, audience_label: audienceLabel, created_at: now }), recipientCount: recipients.size, acknowledgedCount: 0, devices } }, 201);
  });

  // Organizers see every alert in the event; others see the ones they sent or received.
  route("GET", "/api/events/:eventId/alerts", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const rows = await all(
      db,
      `SELECT a.*, ?3 AS event_name,
              (SELECT COUNT(*) FROM alert_recipients r WHERE r.alert_id = a.id) AS recipient_count,
              (SELECT COUNT(*) FROM alert_recipients r WHERE r.alert_id = a.id AND r.acknowledged_at IS NOT NULL) AS acknowledged_count
       FROM alerts a
       WHERE a.event_id = ?1 AND (?4 OR a.sender_email = ?2 OR EXISTS (SELECT 1 FROM alert_recipients r WHERE r.alert_id = a.id AND r.email = ?2))
       ORDER BY a.created_at DESC LIMIT 100`,
      event.id,
      user.email,
      event.name,
      isOrganizer(actor) ? 1 : 0,
    );
    return json({ alerts: rows.map(alertView) });
  });

  // Who has acknowledged an alert. Visible to its sender and the event's organizers.
  route("GET", "/api/events/:eventId/alerts/:alertId", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const alert = await db.prepare("SELECT *, ?3 AS event_name FROM alerts WHERE id = ?1 AND event_id = ?2").bind(valid.id(params.alertId, "Alert"), event.id, event.name).first();
    if (!alert || (!isOrganizer(actor) && alert.sender_email !== user.email)) throw new HttpError(404, "Alert not found.");
    const recipients = await all(
      db,
      `SELECT r.email, r.acknowledged_at AS acknowledgedAt, COALESCE(NULLIF(m.name, ''), '') AS name
       FROM alert_recipients r LEFT JOIN event_members m ON m.event_id = ?2 AND m.email = r.email
       WHERE r.alert_id = ?1 ORDER BY r.acknowledged_at IS NULL DESC, m.name COLLATE NOCASE, r.email`,
      alert.id,
      event.id,
    );
    return json({ alert: alertView(alert), recipients });
  });

  // Alerts sent to the signed-in person in the last week, in events they are still part of.
  route("GET", "/api/alerts/inbox", async ({ db, user, url, now }) => {
    const since = Math.max(Number(url.searchParams.get("since")) || 0, now - INBOX_DAYS * DAY_MS);
    const rows = await all(
      db,
      `SELECT a.*, e.name AS event_name, r.acknowledged_at
       FROM alert_recipients r
       JOIN alerts a ON a.id = r.alert_id
       JOIN events e ON e.id = a.event_id
       JOIN event_members m ON m.event_id = a.event_id AND m.email = r.email
       WHERE r.email = ?1 AND a.created_at > ?2
       ORDER BY a.created_at DESC LIMIT 50`,
      user.email,
      since,
    );
    return json({ alerts: rows.map(alertView), now });
  });

  route("POST", "/api/alerts/:alertId/ack", async ({ db, user, params, now }) => {
    const alertId = valid.id(params.alertId, "Alert");
    const recipient = await db.prepare("SELECT acknowledged_at FROM alert_recipients WHERE alert_id = ?1 AND email = ?2").bind(alertId, user.email).first();
    if (!recipient) throw new HttpError(404, "Alert not found.");
    if (recipient.acknowledged_at === null) {
      await db.prepare("UPDATE alert_recipients SET acknowledged_at = ?3 WHERE alert_id = ?1 AND email = ?2 AND acknowledged_at IS NULL").bind(alertId, user.email, now).run();
    }
    return json({ acknowledgedAt: recipient.acknowledged_at ?? now });
  });
}
