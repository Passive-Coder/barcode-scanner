import { all } from "../db.js";
import { HttpError, json, readBody } from "../http.js";
import * as valid from "../validate.js";

/**
 * The spreadsheet change log: every change a person makes through Linework, kept per person
 * and per spreadsheet. Changes that couldn't reach Google Sheets are stored as "pending", and
 * the person's browser migrates them into the spreadsheet once Google is reachable again.
 */

const KINDS = /** @type {const} */ (["append", "update", "delete-row", "add-tab", "rename-tab", "delete-tab", "add-column", "rename-column", "delete-column"]);
/** Only row changes can wait for Google; structure changes need the live spreadsheet. */
const QUEUEABLE = new Set(["append", "update", "delete-row"]);
const MAX_PAYLOAD_CHARS = 32 * 1024;
const MAX_PENDING_PER_SPREADSHEET = 5000;
const MAX_CLAIM = 500;
/** A browser holds claimed changes this long; each report extends it. */
const CLAIM_MS = 10 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** @param {any} row */
const changeView = (row) => ({
  id: row.id,
  spreadsheetId: row.spreadsheet_id,
  spreadsheetTitle: row.spreadsheet_title,
  sheetId: row.sheet_id,
  sheetTitle: row.sheet_title,
  kind: row.kind,
  payload: JSON.parse(row.payload),
  status: row.status,
  message: row.message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** @param {unknown} value @param {number} now */
function changeFrom(value, now) {
  const change = /** @type {Record<string, any>} */ (value && typeof value === "object" ? value : {});
  const kind = valid.oneOf(change.kind, KINDS, "Change kind");
  const status = valid.oneOf(change.status, /** @type {const} */ (["applied", "pending"]), "Change status");
  if (status === "pending" && !QUEUEABLE.has(kind)) throw new HttpError(400, "Only row changes can be stored until Google Sheets is reachable.");
  if (!change.payload || typeof change.payload !== "object" || Array.isArray(change.payload)) throw new HttpError(400, "A change is missing its details.");
  const payload = JSON.stringify(change.payload);
  if (payload.length > MAX_PAYLOAD_CHARS) throw new HttpError(413, "A change is too large to store.");
  const createdAt = typeof change.createdAt === "number" && Number.isFinite(change.createdAt) ? Math.round(change.createdAt) : now;
  return {
    id: valid.id(change.id, "Change"),
    spreadsheetId: valid.fileId(change.spreadsheetId),
    spreadsheetTitle: valid.text(change.spreadsheetTitle, { label: "Spreadsheet title", max: 200, min: 0 }),
    sheetId: valid.integer(change.sheetId, "Tab ID"),
    sheetTitle: valid.text(change.sheetTitle, { label: "Tab title", max: 200, min: 0 }),
    kind,
    status,
    payload,
    // Clocks differ between devices; keep the browser's order but never a time in the future.
    createdAt: Math.min(now, Math.max(now - MAX_AGE_MS, createdAt)),
  };
}

/** @param {import("../api.js").Register} route */
export function register(route) {
  // Stores changes. IDs come from the browser, so uploading the same change twice stores it once.
  route("POST", "/api/changes", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    if (!Array.isArray(body.changes) || !body.changes.length || body.changes.length > 200) throw new HttpError(400, "Send between 1 and 200 changes.");
    const changes = body.changes.map((change) => changeFrom(change, now));

    /** @type {Map<string, number>} */
    const incoming = new Map();
    for (const change of changes) if (change.status === "pending") incoming.set(change.spreadsheetId, (incoming.get(change.spreadsheetId) ?? 0) + 1);
    if (incoming.size) {
      const counts = await all(
        db,
        "SELECT spreadsheet_id, COUNT(*) AS n FROM sheet_changes WHERE user_id = ?1 AND status IN ('pending', 'migrating') AND spreadsheet_id IN (SELECT value FROM json_each(?2)) GROUP BY spreadsheet_id",
        user.id,
        JSON.stringify([...incoming.keys()]),
      );
      for (const row of counts) {
        if (row.n + (incoming.get(row.spreadsheet_id) ?? 0) > MAX_PENDING_PER_SPREADSHEET) {
          throw new HttpError(409, "Too many changes are waiting for this spreadsheet. Migrate them before making more.");
        }
      }
    }

    await db
      .prepare(
        `INSERT INTO sheet_changes (id, user_id, spreadsheet_id, spreadsheet_title, sheet_id, sheet_title, kind, payload, status, message, created_at, updated_at)
         SELECT json_extract(value, '$.id'), ?1, json_extract(value, '$.spreadsheetId'), json_extract(value, '$.spreadsheetTitle'),
                json_extract(value, '$.sheetId'), json_extract(value, '$.sheetTitle'), json_extract(value, '$.kind'),
                json_extract(value, '$.payload'), json_extract(value, '$.status'), '', json_extract(value, '$.createdAt'), ?2
         FROM json_each(?3) WHERE true
         ON CONFLICT (id) DO NOTHING`,
      )
      .bind(user.id, now, JSON.stringify(changes))
      .run();
    return json({ stored: changes.map((change) => change.id) }, 201);
  });

  // Pending counts for each of the person's spreadsheets.
  route("GET", "/api/changes/summary", async ({ db, user }) => {
    const rows = await all(
      db,
      `SELECT spreadsheet_id, MAX(spreadsheet_title) AS title,
              SUM(status IN ('pending', 'migrating')) AS pending, SUM(status = 'conflict') AS conflicts
       FROM sheet_changes WHERE user_id = ?1 AND status IN ('pending', 'migrating', 'conflict') GROUP BY spreadsheet_id`,
      user.id,
    );
    return json({ spreadsheets: rows.map((row) => ({ spreadsheetId: row.spreadsheet_id, title: row.title, pending: row.pending, conflicts: row.conflicts })) });
  });

  // `view=open`: changes still to migrate or needing attention; `view=history`: the latest log.
  route("GET", "/api/changes", async ({ db, user, url }) => {
    const spreadsheetId = valid.fileId(url.searchParams.get("spreadsheetId"));
    const view = valid.oneOf(url.searchParams.get("view") ?? "open", /** @type {const} */ (["open", "history"]), "View");
    const rows = await all(
      db,
      view === "open"
        ? "SELECT * FROM sheet_changes WHERE user_id = ?1 AND spreadsheet_id = ?2 AND status IN ('pending', 'migrating', 'conflict') ORDER BY created_at, rowid LIMIT 500"
        : "SELECT * FROM sheet_changes WHERE user_id = ?1 AND spreadsheet_id = ?2 ORDER BY created_at DESC, rowid DESC LIMIT 200",
      user.id,
      spreadsheetId,
    );
    return json({ changes: rows.map(changeView) });
  });

  // Hands this browser the spreadsheet's pending changes, oldest first, so it can apply them.
  route("POST", "/api/changes/claim", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const spreadsheetId = valid.fileId(body.spreadsheetId);
    const busy = await db
      .prepare("SELECT 1 FROM sheet_changes WHERE user_id = ?1 AND spreadsheet_id = ?2 AND status = 'migrating' AND claimed_until > ?3 LIMIT 1")
      .bind(user.id, spreadsheetId, now)
      .first();
    if (busy) throw new HttpError(409, "These changes are already being migrated in another window. Try again in a few minutes.");
    const claimId = crypto.randomUUID();
    const { results } = await db
      .prepare(
        `UPDATE sheet_changes SET status = 'migrating', claim_id = ?3, claimed_until = ?4, updated_at = ?5
         WHERE id IN (
           SELECT id FROM sheet_changes
           WHERE user_id = ?1 AND spreadsheet_id = ?2 AND (status = 'pending' OR (status = 'migrating' AND claimed_until <= ?5))
           ORDER BY created_at, rowid LIMIT ?6
         )
         RETURNING *, rowid AS sequence`,
      )
      .bind(user.id, spreadsheetId, claimId, now + CLAIM_MS, now, MAX_CLAIM)
      .all();
    const changes = /** @type {any[]} */ (results).sort((a, b) => a.created_at - b.created_at || a.sequence - b.sequence).map(changeView);
    return json({ claimId, changes });
  });

  // Records what happened to claimed changes. "pending" hands a change back for later.
  route("POST", "/api/changes/report", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const claimId = valid.id(body.claimId, "Claim");
    if (!Array.isArray(body.results) || body.results.length > MAX_CLAIM) throw new HttpError(400, "Send up to 500 results.");
    const results = body.results.map((/** @type {any} */ result) => ({
      id: valid.id(result?.id, "Change"),
      status: valid.oneOf(result?.status, /** @type {const} */ (["applied", "conflict", "pending"]), "Result"),
      message: valid.text(result?.message, { label: "Message", max: 500, min: 0 }),
    }));
    const [updated] = await db.batch([
      db
        .prepare(
          `UPDATE sheet_changes
           SET status = r.status, message = r.message, updated_at = ?3, claim_id = NULL, claimed_until = NULL
           FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.status') AS status, json_extract(value, '$.message') AS message FROM json_each(?4)) AS r
           WHERE sheet_changes.id = r.id AND sheet_changes.user_id = ?1 AND sheet_changes.claim_id = ?2 AND sheet_changes.status = 'migrating'`,
        )
        .bind(user.id, claimId, now, JSON.stringify(results)),
      db.prepare("UPDATE sheet_changes SET claimed_until = ?3 WHERE user_id = ?1 AND claim_id = ?2 AND status = 'migrating'").bind(user.id, claimId, now + CLAIM_MS),
    ]);
    return json({ updated: updated.meta.changes });
  });

  // Gives up on changes that are waiting or couldn't be applied.
  route("POST", "/api/changes/discard", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const ids = valid.ids(body.ids, 500, "Change");
    const { meta } = await db
      .prepare("UPDATE sheet_changes SET status = 'discarded', updated_at = ?2 WHERE user_id = ?1 AND status IN ('pending', 'conflict') AND id IN (SELECT value FROM json_each(?3))")
      .bind(user.id, now, JSON.stringify(ids))
      .run();
    return json({ updated: meta.changes });
  });

  // Puts changes that needed attention back in the queue, for example after fixing a column heading.
  route("POST", "/api/changes/retry", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const ids = valid.ids(body.ids, 500, "Change");
    const { meta } = await db
      .prepare("UPDATE sheet_changes SET status = 'pending', message = '', updated_at = ?2 WHERE user_id = ?1 AND status = 'conflict' AND id IN (SELECT value FROM json_each(?3))")
      .bind(user.id, now, JSON.stringify(ids))
      .run();
    return json({ updated: meta.changes });
  });
}
