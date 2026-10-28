import { beforeEach, describe, expect, it } from "vitest";
import { ORIGIN, createHarness } from "./testing/harness.js";

/** @type {ReturnType<typeof createHarness>} */
let harness;

beforeEach(() => {
  harness = createHarness();
});

describe("sessions", () => {
  it("exchanges a verified Google token for an HttpOnly, SameSite=Strict session", async () => {
    const response = await harness.send("POST", "/api/session", { accessToken: "token:alice" });
    expect(response.status).toBe(200);
    expect(response.data.user).toMatchObject({ email: "alice@example.com", name: "Alice" });
    expect(response.data.vapidPublicKey).toBe("public-key");
    const cookie = /** @type {string} */ (response.headers.get("Set-Cookie"));
    expect(cookie).toMatch(/^__Host-linework_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Secure/);

    const session = await harness.send("GET", "/api/session", undefined, { cookie: cookie.split(";")[0] });
    expect(session.data.user.email).toBe("alice@example.com");
  });

  it("refuses tokens Google doesn't vouch for, and requests without a session", async () => {
    expect((await harness.send("POST", "/api/session", { accessToken: "stolen" })).status).toBe(401);
    expect((await harness.send("GET", "/api/events")).status).toBe(401);
    expect((await harness.send("GET", "/api/events", undefined, { cookie: "__Host-linework_session=forged" })).status).toBe(401);
  });

  it("stores only a hash of the session token", async () => {
    const alice = await harness.signIn("alice");
    const token = alice.cookie.split("=")[1];
    const rows = await harness.db.prepare("SELECT token_hash FROM sessions").all();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0].token_hash).not.toBe(token);
  });

  it("ends the session on sign-out", async () => {
    const alice = await harness.signIn("alice");
    const response = await alice.delete("/api/session");
    expect(response.headers.get("Set-Cookie")).toMatch(/Max-Age=0/);
    expect((await alice.get("/api/session")).status).toBe(401);
  });

  it("expires sessions after twelve hours", async () => {
    const alice = await harness.signIn("alice");
    harness.advance(12 * 60 * 60 * 1000 + 1);
    expect((await alice.get("/api/session")).status).toBe(401);
  });

  it("keeps one account per Google subject when they sign in again", async () => {
    const first = await harness.signIn("alice");
    const second = await harness.signIn("alice");
    expect(second.user.id).toBe(first.user.id);
  });
});

describe("request protection", () => {
  it("refuses changes from other sites", async () => {
    const alice = await harness.signIn("alice");
    const forged = await harness.send("POST", "/api/teams", { name: "Forged" }, { cookie: alice.cookie, headers: { Origin: "https://evil.example" } });
    expect(forged.status).toBe(403);
    const crossSite = await harness.send("POST", "/api/teams", { name: "Forged" }, { cookie: alice.cookie, headers: { "Sec-Fetch-Site": "cross-site" } });
    expect(crossSite.status).toBe(403);
    const noOrigin = await harness.send("POST", "/api/teams", { name: "Forged" }, { cookie: alice.cookie, headers: { Origin: "" } });
    expect(noOrigin.status).toBe(403);
  });

  it("accepts the local development origin", async () => {
    const alice = await harness.signIn("alice");
    const local = await harness.send("POST", "/api/teams", { name: "Local" }, { cookie: alice.cookie, headers: { Origin: "http://localhost:3000" } });
    expect(local.status).toBe(201);
  });

  it("accepts only JSON bodies", async () => {
    const alice = await harness.signIn("alice");
    const response = await harness.send("POST", "/api/teams", undefined, {
      cookie: alice.cookie,
      headers: { "Content-Type": "text/plain" },
    });
    expect(response.status).toBe(415);
  });

  it("answers unknown routes and methods", async () => {
    const alice = await harness.signIn("alice");
    expect((await alice.get("/api/nothing")).status).toBe(404);
    expect((await alice.patch("/api/teams")).status).toBe(405);
  });

  it("sends API responses uncached", async () => {
    const alice = await harness.signIn("alice");
    const response = await alice.get("/api/teams");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(new URL(ORIGIN).protocol).toBe("https:");
  });
});

describe("teams", () => {
  it("lets only the owner edit and delete a team", async () => {
    const alice = await harness.signIn("alice");
    const bob = await harness.signIn("bob");
    const { data } = await alice.post("/api/teams", { name: "Crew", description: "Morning shift" });
    const teamId = data.team.id;

    expect((await bob.patch(`/api/teams/${teamId}`, { name: "Taken" })).status).toBe(404);
    expect((await bob.delete(`/api/teams/${teamId}`)).status).toBe(404);

    const edited = await alice.patch(`/api/teams/${teamId}`, { name: "Day crew", description: "All day" });
    expect(edited.data.team).toMatchObject({ name: "Day crew", description: "All day" });
    expect((await alice.get(`/api/teams/${teamId}`)).data.team.name).toBe("Day crew");

    expect((await alice.delete(`/api/teams/${teamId}`)).status).toBe(200);
    expect((await alice.get(`/api/teams/${teamId}`)).status).toBe(404);
    expect((await alice.get("/api/teams")).data.teams).toEqual([]);
  });

  it("are private contact lists of names and emails", async () => {
    const alice = await harness.signIn("alice");
    const bob = await harness.signIn("bob");
    const { data } = await alice.post("/api/teams", { name: "Volunteers", description: "Weekend crew" });
    const teamId = data.team.id;

    const added = await alice.post(`/api/teams/${teamId}/members`, {
      people: [
        { email: "Ann@Example.com ", name: "Ann" },
        { email: "ann@example.com", name: "" },
        { email: "ben@example.com", name: "Ben" },
      ],
    });
    expect(added.status).toBe(200);
    expect(added.data.members.map((/** @type {any} */ member) => [member.email, member.name])).toEqual([
      ["ann@example.com", "Ann"],
      ["ben@example.com", "Ben"],
    ]);

    expect((await alice.get("/api/teams")).data.teams[0]).toMatchObject({ name: "Volunteers", member_count: 2 });
    expect((await bob.get("/api/teams")).data.teams).toEqual([]);
    expect((await bob.get(`/api/teams/${teamId}`)).status).toBe(404);
    expect((await bob.post(`/api/teams/${teamId}/members`, { people: [{ email: "x@example.com" }] })).status).toBe(404);

    await alice.delete(`/api/teams/${teamId}/members/${encodeURIComponent("ben@example.com")}`);
    expect((await alice.get(`/api/teams/${teamId}`)).data.members).toHaveLength(1);
  });

  it("rejects invalid email addresses", async () => {
    const alice = await harness.signIn("alice");
    const { data } = await alice.post("/api/teams", { name: "Crew" });
    const response = await alice.post(`/api/teams/${data.team.id}/members`, { people: [{ email: "not an email" }] });
    expect(response.status).toBe(400);
    expect(response.data.error).toMatch(/not a valid email/);
  });
});

describe("push subscriptions", () => {
  it("accept only browser push services", async () => {
    const alice = await harness.signIn("alice");
    const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
    expect((await alice.post("/api/push/subscriptions", { endpoint: "https://evil.example/collect", keys })).status).toBe(400);
    expect((await alice.post("/api/push/subscriptions", { endpoint: "http://fcm.googleapis.com/fcm/send/abc", keys })).status).toBe(400);
    expect((await alice.post("/api/push/subscriptions", { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys })).status).toBe(201);
    expect((await alice.post("/api/push/subscriptions/remove", { endpoint: "https://fcm.googleapis.com/fcm/send/abc" })).status).toBe(200);
    const rows = await harness.db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first("n");
    expect(rows).toBe(0);
  });
});
