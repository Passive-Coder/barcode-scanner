import { all, ensure, loadActor, loadSubteamMembers } from "../db.js";
import { HttpError, json, readBody } from "../http.js";
import { canChangeMember, canDeleteEvent, canManageEvent, canSendAlerts, canViewDoc, desiredAccess, sharingPlan } from "../rbac.js";
import * as valid from "../validate.js";

const MAX_EVENTS_OWNED = 100;
const MAX_EVENT_MEMBERS = 2000;
const MAX_SUBTEAMS = 100;
const ORGANIZERS_ONLY = "Only the event's organizers can do that.";

/**
 * @typedef {import("../rbac.js").EventActor} EventActor
 * @typedef {{ id: string, event_id: string, kind: "sheet" | "doc", file_id: string, title: string, managed: number, audience: "everyone" | "organizers" | "subteams", access: "writer" | "reader", created_by: string, created_at: number }} DocRow
 */

/** @param {DocRow} doc @param {string[]} subteamIds */
export const docPolicy = (doc, subteamIds) => ({ audience: doc.audience, access: doc.access, createdBy: doc.created_by, subteamIds });

/**
 * Everything the event page needs, filtered to what this person may see.
 * @param {D1Database} db
 * @param {import("../db.js").EventRow} event
 * @param {EventActor} actor
 */
export async function eventDetail(db, event, actor) {
  const [members, subteams, docs, docSubteams, grants] = await db.batch([
    db.prepare(
      `SELECT m.email, m.name, m.role, m.added_at, EXISTS (SELECT 1 FROM users u WHERE u.email = m.email) AS has_account
       FROM event_members m WHERE m.event_id = ?1 ORDER BY m.role = 'organizer' DESC, lower(COALESCE(NULLIF(m.name, ''), m.email))`,
    ).bind(event.id),
    db.prepare("SELECT id, name, created_at FROM subteams WHERE event_id = ?1 ORDER BY name COLLATE NOCASE").bind(event.id),
    db.prepare("SELECT * FROM event_docs WHERE event_id = ?1 ORDER BY created_at DESC").bind(event.id),
    db.prepare("SELECT ds.doc_id, ds.subteam_id FROM doc_subteams ds JOIN event_docs d ON d.id = ds.doc_id WHERE d.event_id = ?1").bind(event.id),
    db.prepare("SELECT g.doc_id, g.email, g.role, g.permission_id, g.status, g.error FROM doc_grants g JOIN event_docs d ON d.id = g.doc_id WHERE d.event_id = ?1").bind(event.id),
  ]);
  const { bySubteam, membersOf } = await loadSubteamMembers(db, event.id);
  const memberRows = /** @type {Array<{ email: string, name: string, role: "organizer" | "member", added_at: number, has_account: number }>} */ (members.results);

  /** @type {Map<string, string[]>} */
  const subteamsByDoc = new Map();
  for (const row of /** @type {Array<{ doc_id: string, subteam_id: string }>} */ (docSubteams.results)) {
    subteamsByDoc.set(row.doc_id, [...(subteamsByDoc.get(row.doc_id) ?? []), row.subteam_id]);
  }
  /** @type {Map<string, Array<any>>} */
  const grantsByDoc = new Map();
  for (const row of /** @type {Array<any>} */ (grants.results)) {
    grantsByDoc.set(row.doc_id, [...(grantsByDoc.get(row.doc_id) ?? []), { email: row.email, role: row.role, permissionId: row.permission_id, status: row.status, error: row.error }]);
  }

  const visibleDocs = /** @type {DocRow[]} */ (docs.results).flatMap((doc) => {
    const subteamIds = subteamsByDoc.get(doc.id) ?? [];
    const policy = docPolicy(doc, subteamIds);
    if (!canViewDoc(actor, policy)) return [];
    const base = {
      id: doc.id,
      kind: doc.kind,
      fileId: doc.file_id,
      title: doc.title,
      managed: Boolean(doc.managed),
      audience: doc.audience,
      // The audience's access level; organizers and the file's creator can always edit.
      access: doc.access,
      myAccess: actor.role === "organizer" || doc.created_by === actor.email ? "writer" : doc.access,
      subteamIds,
      createdBy: doc.created_by,
      createdAt: doc.created_at,
    };
    if (!doc.managed || (actor.role !== "organizer" && doc.created_by !== actor.email)) return [base];
    const docGrants = grantsByDoc.get(doc.id) ?? [];
    const plan = sharingPlan(desiredAccess(policy, memberRows, membersOf), docGrants);
    return [
      {
        ...base,
        sharing: {
          shared: docGrants.filter((grant) => grant.status === "shared").length,
          pending: plan.share.length + plan.revoke.length,
          failed: docGrants.filter((grant) => grant.status === "failed").map((grant) => ({ email: grant.email, error: grant.error })),
        },
      },
    ];
  });

  return {
    event: { id: event.id, name: event.name, description: event.description, ownerEmail: event.owner_email, createdAt: event.created_at },
    me: {
      email: actor.email,
      role: actor.role,
      isOwner: actor.isOwner,
      manages: actor.manages,
      subteams: actor.subteams,
      canManage: canManageEvent(actor),
      canDelete: canDeleteEvent(actor),
      canSendAlerts: canSendAlerts(actor),
    },
    members: memberRows.map((member) => ({
      email: member.email,
      name: member.name,
      role: member.role,
      isOwner: member.email === event.owner_email,
      hasAccount: Boolean(member.has_account),
      addedAt: member.added_at,
    })),
    subteams: /** @type {Array<{ id: string, name: string, created_at: number }>} */ (subteams.results).map((subteam) => ({
      id: subteam.id,
      name: subteam.name,
      members: bySubteam.get(subteam.id) ?? [],
    })),
    docs: visibleDocs,
  };
}

/**
 * Checks a sub-team's members and managers: everyone must already be in the event, and
 * managers must be members of the sub-team.
 * @param {D1Database} db @param {string} eventId @param {Record<string, any>} body
 */
async function subteamPeople(db, eventId, body) {
  const members = valid.emails(body.members, MAX_EVENT_MEMBERS);
  const managers = valid.emails(body.managers, 50);
  const missing = managers.find((email) => !members.includes(email));
  if (missing) throw new HttpError(400, `${missing} must be in the sub-team to manage it.`);
  if (members.length) {
    const known = await all(db, "SELECT email FROM event_members WHERE event_id = ?1 AND email IN (SELECT value FROM json_each(?2))", eventId, JSON.stringify(members));
    const knownSet = new Set(known.map((row) => row.email));
    const outsider = members.find((email) => !knownSet.has(email));
    if (outsider) throw new HttpError(400, `${outsider} isn't in this event yet. Add them to the event first.`);
  }
  return { members, managers };
}

/**
 * @param {D1Database} db @param {string} subteamId @param {string} eventId
 * @param {{ members: string[], managers: string[] }} people
 */
const insertSubteamMembers = (db, subteamId, eventId, { members, managers }) =>
  db
    .prepare(
      `INSERT INTO subteam_members (subteam_id, event_id, email, is_manager)
       SELECT ?1, ?2, value, value IN (SELECT value FROM json_each(?4)) FROM json_each(?3)`,
    )
    .bind(subteamId, eventId, JSON.stringify(members), JSON.stringify(managers));

/** @param {import("../api.js").Register} route */
export function register(route) {
  route("GET", "/api/events", async ({ db, user }) => {
    const events = await all(
      db,
      `SELECT e.id, e.name, e.description, e.owner_email, e.created_at, m.role,
              (SELECT COUNT(*) FROM event_members x WHERE x.event_id = e.id) AS member_count,
              EXISTS (SELECT 1 FROM subteam_members s WHERE s.event_id = e.id AND s.email = ?1 AND s.is_manager = 1) AS is_manager
       FROM event_members m JOIN events e ON e.id = m.event_id WHERE m.email = ?1 ORDER BY e.created_at DESC`,
      user.email,
    );
    return json({
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        description: event.description,
        role: event.role,
        isOwner: event.owner_email === user.email,
        isManager: Boolean(event.is_manager),
        memberCount: event.member_count,
        createdAt: event.created_at,
      })),
    });
  });

  // Anyone can create an event; they become its owner and first organizer.
  route("POST", "/api/events", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const name = valid.text(body.name, { label: "Event name", max: 120 });
    const description = valid.text(body.description, { label: "Description", max: 2000, min: 0, multiline: true });
    const owned = /** @type {number} */ (await db.prepare("SELECT COUNT(*) AS n FROM events WHERE owner_email = ?1").bind(user.email).first("n"));
    if (owned >= MAX_EVENTS_OWNED) throw new HttpError(409, `You can own up to ${MAX_EVENTS_OWNED} events.`);
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO events (id, name, description, owner_email, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)").bind(id, name, description, user.email, now),
      db.prepare("INSERT INTO event_members (event_id, email, name, role, added_by, added_at) VALUES (?1, ?2, ?3, 'organizer', ?2, ?4)").bind(id, user.email, user.name, now),
    ]);
    const { event, actor } = await loadActor(db, id, user.email);
    return json(await eventDetail(db, event, actor), 201);
  });

  route("GET", "/api/events/:eventId", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    return json(await eventDetail(db, event, actor));
  });

  route("PATCH", "/api/events/:eventId", async ({ request, db, user, params, now }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), ORGANIZERS_ONLY);
    const body = await readBody(request);
    const name = body.name === undefined ? event.name : valid.text(body.name, { label: "Event name", max: 120 });
    const description = body.description === undefined ? event.description : valid.text(body.description, { label: "Description", max: 2000, min: 0, multiline: true });
    await db.prepare("UPDATE events SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1").bind(event.id, name, description, now).run();
    return json(await eventDetail(db, { ...event, name, description }, actor));
  });

  route("DELETE", "/api/events/:eventId", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canDeleteEvent(actor), "Only the event's owner can delete it.");
    await db.prepare("DELETE FROM events WHERE id = ?1").bind(event.id).run();
    return json({ ok: true });
  });

  // Adds people by email. People already in the event keep their role; a name is filled in if given.
  route("POST", "/api/events/:eventId/members", async ({ request, db, user, params, now }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), ORGANIZERS_ONLY);
    const body = await readBody(request);
    const people = valid.people(body.people, { max: 500 });
    const role = valid.oneOf(body.role ?? "member", /** @type {const} */ (["organizer", "member"]), "Role");
    const count = /** @type {number} */ (await db.prepare("SELECT COUNT(*) AS n FROM event_members WHERE event_id = ?1").bind(event.id).first("n"));
    if (count + people.length > MAX_EVENT_MEMBERS) throw new HttpError(409, `An event can have up to ${MAX_EVENT_MEMBERS} people.`);
    await db
      .prepare(
        `INSERT INTO event_members (event_id, email, name, role, added_by, added_at)
         SELECT ?1, json_extract(value, '$.email'), json_extract(value, '$.name'), ?2, ?3, ?4 FROM json_each(?5) WHERE true
         ON CONFLICT (event_id, email) DO UPDATE SET name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE event_members.name END`,
      )
      .bind(event.id, role, user.email, now, JSON.stringify(people))
      .run();
    return json(await eventDetail(db, event, actor));
  });

  route("PATCH", "/api/events/:eventId/members/:email", async ({ request, db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const email = valid.email(params.email);
    const body = await readBody(request);
    const target = await db.prepare("SELECT email, name, role FROM event_members WHERE event_id = ?1 AND email = ?2").bind(event.id, email).first();
    if (!target) throw new HttpError(404, "That person isn't in this event.");
    if (email === event.owner_email) throw new HttpError(403, "The event's owner is always an organizer.");
    ensure(canChangeMember(actor, { email }, event.owner_email, "change"), ORGANIZERS_ONLY);
    const role = body.role === undefined ? target.role : valid.oneOf(body.role, /** @type {const} */ (["organizer", "member"]), "Role");
    const name = body.name === undefined ? target.name : valid.text(body.name, { label: "Name", max: 120, min: 0 });
    await db.prepare("UPDATE event_members SET role = ?3, name = ?4 WHERE event_id = ?1 AND email = ?2").bind(event.id, email, role, name).run();
    const next = email === actor.email ? await loadActor(db, event.id, user.email) : { event, actor };
    return json(await eventDetail(db, next.event, next.actor));
  });

  // Organizers remove people; anyone except the owner can remove themselves (leave the event).
  route("DELETE", "/api/events/:eventId/members/:email", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const email = valid.email(params.email);
    if (email === event.owner_email) throw new HttpError(403, "The event's owner can't be removed. The owner can delete the event instead.");
    ensure(canChangeMember(actor, { email }, event.owner_email, "remove"), ORGANIZERS_ONLY);
    const { meta } = await db.prepare("DELETE FROM event_members WHERE event_id = ?1 AND email = ?2").bind(event.id, email).run();
    if (!meta.changes) throw new HttpError(404, "That person isn't in this event.");
    if (email === actor.email) return json({ left: true });
    return json(await eventDetail(db, event, actor));
  });

  route("POST", "/api/events/:eventId/subteams", async ({ request, db, user, params, now }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), ORGANIZERS_ONLY);
    const body = await readBody(request);
    const name = valid.text(body.name, { label: "Sub-team name", max: 80 });
    const people = await subteamPeople(db, event.id, body);
    const existing = await all(db, "SELECT name FROM subteams WHERE event_id = ?1", event.id);
    if (existing.length >= MAX_SUBTEAMS) throw new HttpError(409, `An event can have up to ${MAX_SUBTEAMS} sub-teams.`);
    if (existing.some((row) => row.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, `There is already a sub-team called “${name}”.`);
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO subteams (id, event_id, name, created_at) VALUES (?1, ?2, ?3, ?4)").bind(id, event.id, name, now),
      insertSubteamMembers(db, id, event.id, people),
    ]);
    return json(await eventDetail(db, event, actor), 201);
  });

  // Renames a sub-team and/or replaces its members and managers.
  route("PATCH", "/api/events/:eventId/subteams/:subteamId", async ({ request, db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), ORGANIZERS_ONLY);
    const subteamId = valid.id(params.subteamId, "Sub-team");
    const subteam = await db.prepare("SELECT id, name FROM subteams WHERE id = ?1 AND event_id = ?2").bind(subteamId, event.id).first();
    if (!subteam) throw new HttpError(404, "Sub-team not found.");
    const body = await readBody(request);
    const statements = [];
    if (body.name !== undefined) {
      const name = valid.text(body.name, { label: "Sub-team name", max: 80 });
      const clash = await db.prepare("SELECT 1 FROM subteams WHERE event_id = ?1 AND id <> ?2 AND lower(name) = lower(?3)").bind(event.id, subteamId, name).first();
      if (clash) throw new HttpError(409, `There is already a sub-team called “${name}”.`);
      statements.push(db.prepare("UPDATE subteams SET name = ?2 WHERE id = ?1").bind(subteamId, name));
    }
    if (body.members !== undefined) {
      const people = await subteamPeople(db, event.id, body);
      statements.push(db.prepare("DELETE FROM subteam_members WHERE subteam_id = ?1").bind(subteamId), insertSubteamMembers(db, subteamId, event.id, people));
    }
    if (statements.length) await db.batch(statements);
    const next = await loadActor(db, event.id, user.email);
    return json(await eventDetail(db, next.event, next.actor));
  });

  route("DELETE", "/api/events/:eventId/subteams/:subteamId", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), ORGANIZERS_ONLY);
    const subteamId = valid.id(params.subteamId, "Sub-team");
    const { meta } = await db.prepare("DELETE FROM subteams WHERE id = ?1 AND event_id = ?2").bind(subteamId, event.id).run();
    if (!meta.changes) throw new HttpError(404, "Sub-team not found.");
    const next = await loadActor(db, event.id, user.email);
    return json(await eventDetail(db, next.event, next.actor));
  });
}
