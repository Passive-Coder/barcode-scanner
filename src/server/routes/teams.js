import { all } from "../db.js";
import { HttpError, json, readBody } from "../http.js";
import * as valid from "../validate.js";

const MAX_TEAMS = 100;
const MAX_TEAM_MEMBERS = 2000;

/**
 * Teams are the signed-in person's own contact lists (like a Google Group): only they can see
 * or change them. They are a quick way to add people to events and sub-teams.
 * @param {D1Database} db @param {string} teamId @param {string} ownerId
 */
async function ownedTeam(db, teamId, ownerId) {
  const team = await db.prepare("SELECT id, name, description, created_at, updated_at FROM teams WHERE id = ?1 AND owner_id = ?2").bind(valid.id(teamId, "Team"), ownerId).first();
  if (!team) throw new HttpError(404, "Team not found.");
  return team;
}

/** @param {import("../api.js").Register} route */
export function register(route) {
  route("GET", "/api/teams", async ({ db, user }) => {
    const teams = await all(
      db,
      `SELECT t.id, t.name, t.description, t.created_at, t.updated_at, (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
       FROM teams t WHERE t.owner_id = ?1 ORDER BY t.name COLLATE NOCASE`,
      user.id,
    );
    return json({ teams });
  });

  route("POST", "/api/teams", async ({ request, db, user, now }) => {
    const body = await readBody(request);
    const name = valid.text(body.name, { label: "Team name", max: 80 });
    const description = valid.text(body.description, { label: "Description", max: 500, min: 0, multiline: true });
    const count = /** @type {number} */ (await db.prepare("SELECT COUNT(*) AS n FROM teams WHERE owner_id = ?1").bind(user.id).first("n"));
    if (count >= MAX_TEAMS) throw new HttpError(409, `You can have up to ${MAX_TEAMS} teams.`);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO teams (id, owner_id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)").bind(id, user.id, name, description, now).run();
    return json({ team: { id, name, description, created_at: now, updated_at: now, member_count: 0 } }, 201);
  });

  route("GET", "/api/teams/:teamId", async ({ db, user, params }) => {
    const team = await ownedTeam(db, params.teamId, user.id);
    const members = await all(db, "SELECT email, name, added_at FROM team_members WHERE team_id = ?1 ORDER BY lower(COALESCE(NULLIF(name, ''), email))", team.id);
    return json({ team, members });
  });

  route("PATCH", "/api/teams/:teamId", async ({ request, db, user, params, now }) => {
    const team = await ownedTeam(db, params.teamId, user.id);
    const body = await readBody(request);
    const name = body.name === undefined ? team.name : valid.text(body.name, { label: "Team name", max: 80 });
    const description = body.description === undefined ? team.description : valid.text(body.description, { label: "Description", max: 500, min: 0, multiline: true });
    await db.prepare("UPDATE teams SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1").bind(team.id, name, description, now).run();
    return json({ team: { ...team, name, description, updated_at: now } });
  });

  route("DELETE", "/api/teams/:teamId", async ({ db, user, params }) => {
    const team = await ownedTeam(db, params.teamId, user.id);
    await db.prepare("DELETE FROM teams WHERE id = ?1").bind(team.id).run();
    return json({ ok: true });
  });

  // Adds people, or updates the names of people already in the team.
  route("POST", "/api/teams/:teamId/members", async ({ request, db, user, params, now }) => {
    const team = await ownedTeam(db, params.teamId, user.id);
    const body = await readBody(request);
    const people = valid.people(body.people, { max: 500 });
    const existing = /** @type {number} */ (await db.prepare("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?1").bind(team.id).first("n"));
    if (existing + people.length > MAX_TEAM_MEMBERS) throw new HttpError(409, `A team can have up to ${MAX_TEAM_MEMBERS} people.`);
    await db.batch([
      db
        .prepare(
          `INSERT INTO team_members (team_id, email, name, added_at)
           SELECT ?1, json_extract(value, '$.email'), json_extract(value, '$.name'), ?2 FROM json_each(?3) WHERE true
           ON CONFLICT (team_id, email) DO UPDATE SET name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE team_members.name END`,
        )
        .bind(team.id, now, JSON.stringify(people)),
      db.prepare("UPDATE teams SET updated_at = ?2 WHERE id = ?1").bind(team.id, now),
    ]);
    const members = await all(db, "SELECT email, name, added_at FROM team_members WHERE team_id = ?1 ORDER BY lower(COALESCE(NULLIF(name, ''), email))", team.id);
    return json({ members });
  });

  route("DELETE", "/api/teams/:teamId/members/:email", async ({ db, user, params, now }) => {
    const team = await ownedTeam(db, params.teamId, user.id);
    const email = valid.email(params.email);
    await db.batch([
      db.prepare("DELETE FROM team_members WHERE team_id = ?1 AND email = ?2").bind(team.id, email),
      db.prepare("UPDATE teams SET updated_at = ?2 WHERE id = ?1").bind(team.id, now),
    ]);
    return json({ ok: true });
  });
}
