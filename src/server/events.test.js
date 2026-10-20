import { beforeEach, describe, expect, it } from "vitest";
import { createHarness } from "./testing/harness.js";

/** @type {ReturnType<typeof createHarness>} */
let harness;
/** @type {Awaited<ReturnType<ReturnType<typeof createHarness>["signIn"]>>} */
let alice;
/** @type {typeof alice} */
let bob;
/** @type {typeof alice} */
let carol;
/** @type {typeof alice} */
let dave;
/** @type {typeof alice} */
let erin;
let eventId = "";

const person = (/** @type {string} */ name) => ({ email: `${name}@example.com`, name: name[0].toUpperCase() + name.slice(1) });
const at = (/** @type {string} */ email) => encodeURIComponent(email);

/**
 * alice owns "Fest" with organizer dave and members bob, carol, and erin. The "Logistics"
 * sub-team has bob (its manager) and carol.
 */
beforeEach(async () => {
  harness = createHarness();
  [alice, bob, carol, dave, erin] = await Promise.all(["alice", "bob", "carol", "dave", "erin"].map((name) => harness.signIn(name)));
  const created = await alice.post("/api/events", { name: "Fest", description: "Spring festival" });
  expect(created.status).toBe(201);
  eventId = created.data.event.id;
  await alice.post(`/api/events/${eventId}/members`, { people: [person("bob"), person("carol"), person("erin")] });
  await alice.post(`/api/events/${eventId}/members`, { people: [person("dave")], role: "organizer" });
  const subteam = await alice.post(`/api/events/${eventId}/subteams`, { name: "Logistics", members: [bob.email, carol.email], managers: [bob.email] });
  expect(subteam.status).toBe(201);
});

const logisticsId = async () => (await alice.get(`/api/events/${eventId}`)).data.subteams.find((/** @type {any} */ team) => team.name === "Logistics").id;

describe("events", () => {
  it("make the creator the owner and an organizer", async () => {
    const { data } = await alice.get(`/api/events/${eventId}`);
    expect(data.me).toMatchObject({ role: "organizer", isOwner: true, canManage: true, canDelete: true });
    expect(data.members.find((/** @type {any} */ member) => member.email === alice.email)).toMatchObject({ role: "organizer", isOwner: true });
    expect(data.members).toHaveLength(5);
  });

  it("are hidden from people outside them", async () => {
    const outsider = await harness.signIn("zed");
    expect((await outsider.get(`/api/events/${eventId}`)).status).toBe(404);
    expect((await outsider.get("/api/events")).data.events).toEqual([]);
    expect((await outsider.post(`/api/events/${eventId}/members`, { people: [person("zed")] })).status).toBe(404);
  });

  it("list each person's role", async () => {
    const [mine] = (await bob.get("/api/events")).data.events;
    expect(mine).toMatchObject({ name: "Fest", role: "member", isManager: true, memberCount: 5 });
  });

  it("let only organizers manage people and details", async () => {
    expect((await bob.post(`/api/events/${eventId}/members`, { people: [person("zed")] })).status).toBe(403);
    expect((await bob.patch(`/api/events/${eventId}`, { name: "Mine now" })).status).toBe(403);
    expect((await bob.patch(`/api/events/${eventId}/members/${at(carol.email)}`, { role: "organizer" })).status).toBe(403);
    expect((await dave.post(`/api/events/${eventId}/members`, { people: [person("zed")] })).status).toBe(200);
    expect((await dave.patch(`/api/events/${eventId}`, { name: "Fest 2026" })).data.event.name).toBe("Fest 2026");
  });

  it("protect the owner", async () => {
    expect((await dave.delete(`/api/events/${eventId}/members/${at(alice.email)}`)).status).toBe(403);
    expect((await dave.patch(`/api/events/${eventId}/members/${at(alice.email)}`, { role: "member" })).status).toBe(403);
    expect((await dave.delete(`/api/events/${eventId}`)).status).toBe(403);
    expect((await alice.delete(`/api/events/${alice.email}`)).status).toBe(400);
  });

  it("keep existing roles when people are added again", async () => {
    await alice.post(`/api/events/${eventId}/members`, { people: [{ email: dave.email, name: "" }], role: "member" });
    const { data } = await alice.get(`/api/events/${eventId}`);
    expect(data.members.find((/** @type {any} */ member) => member.email === dave.email)).toMatchObject({ role: "organizer", name: "Dave" });
  });

  it("let members leave, which removes them from sub-teams", async () => {
    const left = await carol.delete(`/api/events/${eventId}/members/${at(carol.email)}`);
    expect(left.data).toEqual({ left: true });
    const { data } = await alice.get(`/api/events/${eventId}`);
    expect(data.subteams[0].members.map((/** @type {any} */ member) => member.email)).toEqual([bob.email]);
    expect((await carol.get(`/api/events/${eventId}`)).status).toBe(404);
  });

  it("let the owner delete the event and everything in it", async () => {
    expect((await alice.delete(`/api/events/${eventId}`)).status).toBe(200);
    expect((await bob.get(`/api/events/${eventId}`)).status).toBe(404);
    expect(await harness.db.prepare("SELECT COUNT(*) AS n FROM subteam_members").first("n")).toBe(0);
  });
});

describe("sub-teams", () => {
  it("need their people in the event and managers among their members", async () => {
    const outsider = await alice.post(`/api/events/${eventId}/subteams`, { name: "Stage", members: ["zed@example.com"] });
    expect(outsider.status).toBe(400);
    expect(outsider.data.error).toMatch(/isn't in this event/);
    const manager = await alice.post(`/api/events/${eventId}/subteams`, { name: "Stage", members: [carol.email], managers: [erin.email] });
    expect(manager.status).toBe(400);
    const duplicate = await alice.post(`/api/events/${eventId}/subteams`, { name: "logistics", members: [] });
    expect(duplicate.status).toBe(409);
  });

  it("are managed by organizers only", async () => {
    const id = await logisticsId();
    expect((await bob.patch(`/api/events/${eventId}/subteams/${id}`, { members: [bob.email, erin.email], managers: [bob.email] })).status).toBe(403);
    const updated = await dave.patch(`/api/events/${eventId}/subteams/${id}`, { members: [bob.email, erin.email], managers: [erin.email] });
    expect(updated.status).toBe(200);
    expect(updated.data.subteams[0].members).toEqual([
      { email: bob.email, isManager: false },
      { email: erin.email, isManager: true },
    ]);
  });

  it("show each person what they manage", async () => {
    const id = await logisticsId();
    const { data } = await bob.get(`/api/events/${eventId}`);
    expect(data.me).toMatchObject({ role: "member", manages: [id], canSendAlerts: true, canManage: false });
  });
});

describe("alerts", () => {
  it("let organizers page everyone, delivered to registered devices", async () => {
    const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
    await carol.post("/api/push/subscriptions", { endpoint: "https://fcm.googleapis.com/fcm/send/carol", keys });
    await erin.post("/api/push/subscriptions", { endpoint: "https://fcm.googleapis.com/fcm/send/gone-erin", keys });

    const sent = await alice.post(`/api/events/${eventId}/alerts`, { title: "Doors open", body: "Everyone to the gate", urgency: "page", audience: { type: "everyone" } });
    expect(sent.status).toBe(201);
    expect(sent.data.alert).toMatchObject({ audienceLabel: "Everyone", recipientCount: 4, devices: 2 });

    await harness.settle();
    expect(harness.pushes).toHaveLength(1);
    expect(harness.pushes[0].message).toMatchObject({ type: "alert", title: "Doors open", urgency: "page", eventName: "Fest" });
    expect(harness.pushes[0].options.urgent).toBe(true);
    // The push service said erin's device is gone, so it's forgotten.
    const left = await harness.db.prepare("SELECT endpoint FROM push_subscriptions").all();
    expect(left.results.map((row) => row.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/carol"]);

    const inbox = await carol.get("/api/alerts/inbox");
    expect(inbox.data.alerts).toHaveLength(1);
    expect(inbox.data.alerts[0]).toMatchObject({ title: "Doors open", eventName: "Fest", acknowledgedAt: null });
    expect((await alice.get("/api/alerts/inbox")).data.alerts).toEqual([]);
  });

  it("let managers page only their sub-teams", async () => {
    const id = await logisticsId();
    const page = await bob.post(`/api/events/${eventId}/alerts`, { title: "Truck here", urgency: "page", audience: { type: "subteams", subteamIds: [id] } });
    expect(page.status).toBe(201);
    expect(page.data.alert).toMatchObject({ audienceLabel: "Logistics", recipientCount: 1 });
    const tagged = await bob.post(`/api/events/${eventId}/alerts`, { title: "Carol?", urgency: "page", audience: { type: "people", emails: [carol.email] } });
    expect(tagged.status).toBe(201);

    expect((await bob.post(`/api/events/${eventId}/alerts`, { title: "All", urgency: "page", audience: { type: "everyone" } })).status).toBe(403);
    expect((await bob.post(`/api/events/${eventId}/alerts`, { title: "Erin", urgency: "page", audience: { type: "people", emails: [erin.email] } })).status).toBe(403);
    expect((await carol.post(`/api/events/${eventId}/alerts`, { title: "Hi", urgency: "notice", audience: { type: "subteams", subteamIds: [id] } })).status).toBe(403);
    expect((await erin.get("/api/alerts/inbox")).data.alerts).toEqual([]);
  });

  it("track acknowledgements", async () => {
    const sent = await alice.post(`/api/events/${eventId}/alerts`, { title: "Check in", urgency: "page", audience: { type: "people", emails: [carol.email, erin.email] } });
    const alertId = sent.data.alert.id;
    expect((await carol.post(`/api/alerts/${alertId}/ack`)).status).toBe(200);
    expect((await bob.post(`/api/alerts/${alertId}/ack`)).status).toBe(404);

    const list = await alice.get(`/api/events/${eventId}/alerts`);
    expect(list.data.alerts[0]).toMatchObject({ recipientCount: 2, acknowledgedCount: 1 });
    const detail = await alice.get(`/api/events/${eventId}/alerts/${alertId}`);
    expect(detail.data.recipients.map((/** @type {any} */ row) => [row.email, row.acknowledgedAt !== null])).toEqual([
      [erin.email, false],
      [carol.email, true],
    ]);
    expect((await carol.get(`/api/events/${eventId}/alerts/${alertId}`)).status).toBe(404);
    expect((await carol.get(`/api/events/${eventId}/alerts`)).data.alerts).toHaveLength(1);
    expect((await bob.get(`/api/events/${eventId}/alerts`)).data.alerts).toHaveLength(0);
  });

  it("are rate limited per sender", async () => {
    const send = () => alice.post(`/api/events/${eventId}/alerts`, { title: "Ping", urgency: "notice", audience: { type: "everyone" } });
    for (let index = 0; index < 10; index++) expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(429);
    harness.advance(61_000);
    expect((await send()).status).toBe(201);
  });

  it("stop reaching people removed from the event", async () => {
    await alice.post(`/api/events/${eventId}/alerts`, { title: "Ping", urgency: "notice", audience: { type: "everyone" } });
    await alice.delete(`/api/events/${eventId}/members/${at(erin.email)}`);
    expect((await erin.get("/api/alerts/inbox")).data.alerts).toEqual([]);
  });
});

describe("event documents", () => {
  const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd";

  /** @param {Record<string, unknown>} [overrides] */
  const addDoc = async (overrides = {}) => {
    const id = await logisticsId();
    return alice.post(`/api/events/${eventId}/docs`, { kind: "sheet", fileId: FILE_ID, title: "Inventory", managed: true, audience: "subteams", access: "reader", subteamIds: [id], ...overrides });
  };

  it("are visible to their audience and organizers only", async () => {
    expect((await addDoc()).status).toBe(201);
    expect((await bob.get(`/api/events/${eventId}`)).data.docs.map((/** @type {any} */ doc) => doc.title)).toEqual(["Inventory"]);
    expect((await erin.get(`/api/events/${eventId}`)).data.docs).toEqual([]);
    const [organizerView] = (await dave.get(`/api/events/${eventId}`)).data.docs;
    expect(organizerView).toMatchObject({ myAccess: "writer", access: "reader", sharing: { pending: 3 } });
    const [memberView] = (await bob.get(`/api/events/${eventId}`)).data.docs;
    expect(memberView.myAccess).toBe("reader");
    expect(memberView.sharing).toBeUndefined();
    expect((await bob.post(`/api/events/${eventId}/docs`, { kind: "doc", fileId: FILE_ID, title: "Mine", audience: "everyone", access: "writer" })).status).toBe(403);
    expect((await addDoc()).status).toBe(409);
  });

  it("plan Drive sharing for the file's creator only", async () => {
    const created = await addDoc();
    const docId = created.data.docId;
    expect((await dave.get(`/api/events/${eventId}/docs/${docId}/sharing`)).status).toBe(403);

    const plan = await alice.get(`/api/events/${eventId}/docs/${docId}/sharing`);
    expect(plan.data.fileId).toBe(FILE_ID);
    const byEmail = (/** @type {any} */ a, /** @type {any} */ b) => a.email.localeCompare(b.email);
    expect([...plan.data.share].sort(byEmail)).toEqual([
      { email: bob.email, role: "reader", permissionId: "" },
      { email: carol.email, role: "reader", permissionId: "" },
      { email: dave.email, role: "writer", permissionId: "" },
    ]);

    const reported = await alice.post(`/api/events/${eventId}/docs/${docId}/sharing`, {
      results: [
        { email: bob.email, role: "reader", permissionId: "perm-bob", status: "shared" },
        { email: carol.email, role: "reader", status: "failed", error: "No Google account" },
        { email: dave.email, role: "writer", permissionId: "perm-dave", status: "shared" },
      ],
    });
    expect(reported.data.share).toEqual([]);
    expect(reported.data.revoke).toEqual([]);
    const retry = await alice.get(`/api/events/${eventId}/docs/${docId}/sharing?retry=1`);
    expect(retry.data.share.map((/** @type {any} */ item) => item.email)).toEqual([carol.email]);

    // Removing bob from the event means his access must be revoked.
    await alice.delete(`/api/events/${eventId}/members/${at(bob.email)}`);
    const after = await alice.get(`/api/events/${eventId}/docs/${docId}/sharing`);
    expect(after.data.revoke).toEqual([{ email: bob.email, permissionId: "perm-bob" }]);
    expect((await alice.get("/api/sharing/pending")).data.pending).toEqual([{ eventId, docId, title: "Inventory" }]);
    await alice.post(`/api/events/${eventId}/docs/${docId}/sharing`, { results: [], revoked: [bob.email] });
    expect((await alice.get("/api/sharing/pending")).data.pending).toEqual([]);
  });

  it("can be re-scoped to everyone with edit access", async () => {
    const created = await addDoc();
    const docId = created.data.docId;
    const updated = await alice.patch(`/api/events/${eventId}/docs/${docId}`, { audience: "everyone", access: "writer" });
    expect(updated.status).toBe(200);
    expect((await erin.get(`/api/events/${eventId}`)).data.docs[0]).toMatchObject({ myAccess: "writer", subteamIds: [] });
    const plan = await alice.get(`/api/events/${eventId}/docs/${docId}/sharing`);
    expect(plan.data.share).toHaveLength(4);
  });

  it("need sub-teams from the same event", async () => {
    const response = await addDoc({ subteamIds: ["00000000-0000-4000-8000-000000000000"] });
    expect(response.status).toBe(400);
    expect((await addDoc({ subteamIds: [] })).status).toBe(400);
  });
});
