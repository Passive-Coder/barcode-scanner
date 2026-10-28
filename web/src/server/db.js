import { HttpError } from "./http.js";

/**
 * Shared queries for event routes.
 * @typedef {import("./rbac.js").EventActor} EventActor
 * @typedef {{ id: string, name: string, description: string, owner_email: string, created_at: number, updated_at: number }} EventRow
 */

/**
 * @template [T=Record<string, any>]
 * @param {D1Database} db @param {string} sql @param {...unknown} values
 * @returns {Promise<T[]>}
 */
export async function all(db, sql, ...values) {
  const { results } = await db.prepare(sql).bind(...values).all();
  return /** @type {T[]} */ (results);
}

/**
 * Loads the event and the signed-in person's place in it. Someone outside the event gets the
 * same "not found" as for an event that doesn't exist, so events can't be probed for.
 * @param {D1Database} db
 * @param {string} eventId
 * @param {string} email
 * @returns {Promise<{ event: EventRow, actor: EventActor }>}
 */
export async function loadActor(db, eventId, email) {
  const [membership, subteams] = await db.batch([
    db.prepare("SELECT e.*, m.role FROM event_members m JOIN events e ON e.id = m.event_id WHERE m.event_id = ?1 AND m.email = ?2").bind(eventId, email),
    db.prepare("SELECT subteam_id, is_manager FROM subteam_members WHERE event_id = ?1 AND email = ?2").bind(eventId, email),
  ]);
  const row = /** @type {(EventRow & { role: "organizer" | "member" }) | undefined} */ (membership.results[0]);
  if (!row) throw new HttpError(404, "Event not found, or you're not part of it.");
  const memberships = /** @type {Array<{ subteam_id: string, is_manager: number }>} */ (subteams.results);
  const { role, ...event } = row;
  return {
    event,
    actor: {
      email,
      role,
      isOwner: event.owner_email === email,
      manages: memberships.filter((item) => item.is_manager).map((item) => item.subteam_id),
      subteams: memberships.map((item) => item.subteam_id),
    },
  };
}

/**
 * Every sub-team's members, and a helper that returns everyone in a set of sub-teams.
 * @param {D1Database} db
 * @param {string} eventId
 */
export async function loadSubteamMembers(db, eventId) {
  const rows = await all(db, "SELECT subteam_id, email, is_manager FROM subteam_members WHERE event_id = ?1 ORDER BY email", eventId);
  /** @type {Map<string, Array<{ email: string, isManager: boolean }>>} */
  const bySubteam = new Map();
  for (const row of /** @type {Array<{ subteam_id: string, email: string, is_manager: number }>} */ (rows)) {
    const list = bySubteam.get(row.subteam_id) ?? [];
    list.push({ email: row.email, isManager: Boolean(row.is_manager) });
    bySubteam.set(row.subteam_id, list);
  }
  /** @param {string[]} subteamIds */
  const membersOf = (subteamIds) => new Set(subteamIds.flatMap((id) => (bySubteam.get(id) ?? []).map((member) => member.email)));
  return { bySubteam, membersOf };
}

/** @param {boolean} allowed @param {string} message */
export function ensure(allowed, message) {
  if (!allowed) throw new HttpError(403, message);
}
