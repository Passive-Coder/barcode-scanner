import { all, ensure, loadActor } from "../db.js";
import { HttpError, json, readBody } from "../http.js";
import { canManageEvent, desiredAccess, sharingPlan } from "../rbac.js";
import * as valid from "../validate.js";
import { docPolicy, eventDetail } from "./events.js";

const MAX_DOCS = 200;
const PERMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const KINDS = /** @type {const} */ (["sheet", "doc"]);
const AUDIENCES = /** @type {const} */ (["everyone", "organizers", "subteams"]);
const ACCESS = /** @type {const} */ (["writer", "reader"]);

/** @typedef {import("./events.js").DocRow} DocRow */

/**
 * Validates who a document is for. Sub-teams must belong to this event, and a sub-team
 * audience needs at least one of them.
 * @param {D1Database} db @param {string} eventId @param {Record<string, any>} body
 * @param {{ audience: string, access: string, subteamIds: string[] }} [current]
 */
async function audienceFrom(db, eventId, body, current) {
  const audience = body.audience === undefined && current ? current.audience : valid.oneOf(body.audience, AUDIENCES, "Audience");
  const access = body.access === undefined && current ? current.access : valid.oneOf(body.access, ACCESS, "Access");
  let subteamIds = body.subteamIds === undefined && current ? current.subteamIds : valid.ids(body.subteamIds, 100, "Sub-team");
  if (audience !== "subteams") subteamIds = [];
  if (audience === "subteams" && !subteamIds.length) throw new HttpError(400, "Choose at least one sub-team.");
  if (subteamIds.length) {
    const found = await all(db, "SELECT id FROM subteams WHERE event_id = ?1 AND id IN (SELECT value FROM json_each(?2))", eventId, JSON.stringify(subteamIds));
    if (found.length !== subteamIds.length) throw new HttpError(400, "One of those sub-teams isn't part of this event.");
  }
  return { audience, access, subteamIds };
}

/** @param {D1Database} db @param {string} docId @param {string} eventId @returns {Promise<DocRow>} */
async function loadDoc(db, docId, eventId) {
  const doc = await db.prepare("SELECT * FROM event_docs WHERE id = ?1 AND event_id = ?2").bind(valid.id(docId, "Document"), eventId).first();
  if (!doc) throw new HttpError(404, "Document not found.");
  return /** @type {DocRow} */ (doc);
}

/**
 * The Drive sharing changes still needed for managed files, loaded together in a handful of
 * queries. Only a file's creator can make them, because Linework's Drive access covers only
 * the files it created for that person.
 * @param {D1Database} db @param {DocRow[]} docs @param {{ retryFailed?: boolean }} [options]
 * @returns {Promise<Map<string, ReturnType<typeof sharingPlan>>>} keyed by document ID
 */
async function plansFor(db, docs, options) {
  /** @type {Map<string, ReturnType<typeof sharingPlan>>} */
  const plans = new Map();
  if (!docs.length) return plans;
  const eventIds = JSON.stringify([...new Set(docs.map((doc) => doc.event_id))]);
  const docIds = JSON.stringify(docs.map((doc) => doc.id));
  const [members, subteamMembers, docSubteams, grants] = /** @type {Array<{ results: any[] }>} */ (
    await db.batch([
      db.prepare("SELECT event_id, email, role FROM event_members WHERE event_id IN (SELECT value FROM json_each(?1))").bind(eventIds),
      db.prepare("SELECT event_id, subteam_id, email FROM subteam_members WHERE event_id IN (SELECT value FROM json_each(?1))").bind(eventIds),
      db.prepare("SELECT doc_id, subteam_id FROM doc_subteams WHERE doc_id IN (SELECT value FROM json_each(?1))").bind(docIds),
      db.prepare("SELECT doc_id, email, role, permission_id AS permissionId, status FROM doc_grants WHERE doc_id IN (SELECT value FROM json_each(?1))").bind(docIds),
    ])
  );
  for (const doc of docs) {
    const people = members.results.filter((row) => row.event_id === doc.event_id);
    /** @param {string[]} subteamIds */
    const membersOf = (subteamIds) => new Set(subteamMembers.results.filter((row) => subteamIds.includes(row.subteam_id)).map((row) => row.email));
    const subteamIds = docSubteams.results.filter((row) => row.doc_id === doc.id).map((row) => row.subteam_id);
    const desired = desiredAccess(docPolicy(doc, subteamIds), people, membersOf);
    plans.set(doc.id, sharingPlan(desired, grants.results.filter((row) => row.doc_id === doc.id), options));
  }
  return plans;
}

/** @param {D1Database} db @param {DocRow} doc @param {{ retryFailed?: boolean }} [options] */
const planFor = async (db, doc, options) => /** @type {ReturnType<typeof sharingPlan>} */ ((await plansFor(db, [doc], options)).get(doc.id));

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Lists a Google Sheet or Doc in the event. `managed` files were just created by Linework in
  // the organizer's Drive; others are linked and keep the sharing their owner gave them.
  route("POST", "/api/events/:eventId/docs", async ({ request, db, user, params, now }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), "Only the event's organizers can add documents.");
    const body = await readBody(request);
    const kind = valid.oneOf(body.kind, KINDS, "Kind");
    const fileId = valid.fileId(body.fileId);
    const title = valid.text(body.title, { label: "Title", max: 200 });
    const managed = body.managed === true;
    const { audience, access, subteamIds } = await audienceFrom(db, event.id, body);
    const count = /** @type {number} */ (await db.prepare("SELECT COUNT(*) AS n FROM event_docs WHERE event_id = ?1").bind(event.id).first("n"));
    if (count >= MAX_DOCS) throw new HttpError(409, `An event can list up to ${MAX_DOCS} documents.`);
    if (await db.prepare("SELECT 1 FROM event_docs WHERE event_id = ?1 AND file_id = ?2").bind(event.id, fileId).first()) {
      throw new HttpError(409, "That file is already listed in this event.");
    }
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare("INSERT INTO event_docs (id, event_id, kind, file_id, title, managed, audience, access, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)")
        .bind(id, event.id, kind, fileId, title, managed ? 1 : 0, audience, access, user.email, now),
      db.prepare("INSERT INTO doc_subteams (doc_id, subteam_id) SELECT ?1, value FROM json_each(?2)").bind(id, JSON.stringify(subteamIds)),
    ]);
    return json({ docId: id, ...(await eventDetail(db, event, actor)) }, 201);
  });

  route("PATCH", "/api/events/:eventId/docs/:docId", async ({ request, db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), "Only the event's organizers can change documents.");
    const doc = await loadDoc(db, params.docId, event.id);
    const body = await readBody(request);
    const current = await all(db, "SELECT subteam_id FROM doc_subteams WHERE doc_id = ?1", doc.id);
    const title = body.title === undefined ? doc.title : valid.text(body.title, { label: "Title", max: 200 });
    const next = await audienceFrom(db, event.id, body, { audience: doc.audience, access: doc.access, subteamIds: current.map((row) => row.subteam_id) });
    await db.batch([
      db.prepare("UPDATE event_docs SET title = ?2, audience = ?3, access = ?4 WHERE id = ?1").bind(doc.id, title, next.audience, next.access),
      db.prepare("DELETE FROM doc_subteams WHERE doc_id = ?1").bind(doc.id),
      db.prepare("INSERT INTO doc_subteams (doc_id, subteam_id) SELECT ?1, value FROM json_each(?2)").bind(doc.id, JSON.stringify(next.subteamIds)),
    ]);
    return json(await eventDetail(db, event, actor));
  });

  // Removes the listing only. The file stays in its owner's Google Drive.
  route("DELETE", "/api/events/:eventId/docs/:docId", async ({ db, user, params }) => {
    const { event, actor } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    ensure(canManageEvent(actor), "Only the event's organizers can remove documents.");
    const doc = await loadDoc(db, params.docId, event.id);
    await db.prepare("DELETE FROM event_docs WHERE id = ?1").bind(doc.id).run();
    return json(await eventDetail(db, event, actor));
  });

  // `?retry=1` includes shares that failed before.
  route("GET", "/api/events/:eventId/docs/:docId/sharing", async ({ db, user, params, url }) => {
    const { event } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const doc = await loadDoc(db, params.docId, event.id);
    if (!doc.managed) throw new HttpError(409, "Linework doesn't manage this file's sharing.");
    ensure(doc.created_by === user.email, "Only the person who created this file can change its sharing.");
    return json({ fileId: doc.file_id, ...(await planFor(db, doc, { retryFailed: url.searchParams.get("retry") === "1" })) });
  });

  // The creator's browser reports what it changed in Google Drive.
  route("POST", "/api/events/:eventId/docs/:docId/sharing", async ({ request, db, user, params, now }) => {
    const { event } = await loadActor(db, valid.id(params.eventId, "Event"), user.email);
    const doc = await loadDoc(db, params.docId, event.id);
    if (!doc.managed) throw new HttpError(409, "Linework doesn't manage this file's sharing.");
    ensure(doc.created_by === user.email, "Only the person who created this file can change its sharing.");
    const body = await readBody(request);
    const results = Array.isArray(body.results) ? body.results : [];
    const revoked = valid.emails(body.revoked, 2000);
    if (results.length > 2000) throw new HttpError(400, "Too many sharing results.");
    const rows = results.map((result) => {
      const status = valid.oneOf(result?.status, /** @type {const} */ (["shared", "failed"]), "Status");
      const permissionId = status === "shared" ? String(result.permissionId ?? "") : "";
      if (status === "shared" && !PERMISSION_ID_PATTERN.test(permissionId)) throw new HttpError(400, "A Drive permission ID is not valid.");
      return {
        email: valid.email(result?.email),
        role: valid.oneOf(result?.role, ACCESS, "Role"),
        permissionId,
        status,
        error: status === "failed" ? valid.text(result.error, { label: "Error", max: 300, min: 0 }) : "",
      };
    });
    await db.batch([
      db
        .prepare(
          `INSERT INTO doc_grants (doc_id, email, role, permission_id, status, error, updated_at)
           SELECT ?1, json_extract(value, '$.email'), json_extract(value, '$.role'), json_extract(value, '$.permissionId'), json_extract(value, '$.status'), json_extract(value, '$.error'), ?2
           FROM json_each(?3) WHERE true
           ON CONFLICT (doc_id, email) DO UPDATE SET
             -- A failed role change must not forget a permission that is still in place.
             role = CASE WHEN excluded.status = 'failed' AND doc_grants.status = 'shared' THEN doc_grants.role ELSE excluded.role END,
             permission_id = CASE WHEN excluded.status = 'shared' THEN excluded.permission_id ELSE doc_grants.permission_id END,
             status = CASE WHEN excluded.status = 'failed' AND doc_grants.status = 'shared' THEN 'shared' ELSE excluded.status END,
             error = excluded.error,
             updated_at = excluded.updated_at`,
        )
        .bind(doc.id, now, JSON.stringify(rows)),
      db.prepare("DELETE FROM doc_grants WHERE doc_id = ?1 AND email IN (SELECT value FROM json_each(?2))").bind(doc.id, JSON.stringify(revoked)),
    ]);
    return json({ ok: true, ...(await planFor(db, doc)) });
  });

  // Managed files this person created whose sharing is out of date, across all their events,
  // so their browser can bring sharing up to date soon after they sign in.
  route("GET", "/api/sharing/pending", async ({ db, user }) => {
    const docs = /** @type {DocRow[]} */ (
      await all(
        db,
        `SELECT d.* FROM event_docs d JOIN event_members m ON m.event_id = d.event_id AND m.email = ?1
         WHERE d.created_by = ?1 AND d.managed = 1 ORDER BY d.created_at LIMIT 200`,
        user.email,
      )
    );
    const plans = await plansFor(db, docs);
    const pending = docs
      .filter((doc) => {
        const plan = plans.get(doc.id);
        return Boolean(plan?.share.length || plan?.revoke.length);
      })
      .map((doc) => ({ eventId: doc.event_id, docId: doc.id, title: doc.title }));
    return json({ pending });
  });
}
