import { beforeEach, describe, expect, it, vi } from "vitest";
import { isExpoPushToken, sendNativePush } from "./native-push.js";
import { ORIGIN, createHarness } from "./testing/harness.js";

/** @type {ReturnType<typeof createHarness>} */
let harness;

beforeEach(() => {
  harness = createHarness();
});

describe("mobile app sessions", () => {
  it("hand the app a bearer token instead of a cookie", async () => {
    const app = await harness.signInApp("alice");
    expect(app.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(app.setCookie).toBeNull();
    expect(app.session.expiresAt - harness.now()).toBe(30 * 24 * 60 * 60 * 1000);
    expect((await app.get("/api/session")).data.user.email).toBe("alice@example.com");
  });

  it("accept Google sign-ins from the app's own OAuth clients only", async () => {
    await expect(harness.signInApp("alice", "android.apps.googleusercontent.com")).resolves.toBeTruthy();
    await expect(harness.signInApp("alice", "someone-else.apps.googleusercontent.com")).rejects.toThrow(/different app/);
  });

  it("let the app make changes without an Origin header", async () => {
    const app = await harness.signInApp("alice");
    const created = await app.post("/api/teams", { name: "Crew" });
    expect(created.status).toBe(201);
  });

  it("still refuse cookie requests without an Origin header", async () => {
    const alice = await harness.signIn("alice");
    const response = await harness.send("POST", "/api/teams", { name: "Forged" }, { cookie: alice.cookie, headers: { Origin: null } });
    expect(response.status).toBe(403);
  });

  it("reject made-up bearer tokens", async () => {
    const response = await harness.send("GET", "/api/teams", undefined, { headers: { Authorization: "Bearer not-a-real-session-token-000000", Origin: null } });
    expect(response.status).toBe(401);
    const malformed = await harness.send("GET", "/api/teams", undefined, { headers: { Authorization: "Basic abc", Origin: null } });
    expect(malformed.status).toBe(401);
  });

  it("end on sign-out", async () => {
    const app = await harness.signInApp("alice");
    expect((await app.delete("/api/session")).status).toBe(200);
    expect((await app.get("/api/session")).status).toBe(401);
  });
});

describe("cross-origin requests", () => {
  it("are allowed from Linework's other origins with a bearer token", async () => {
    const app = await harness.signInApp("alice");
    const preflight = await harness.raw(new Request(`${ORIGIN}/api/teams`, { method: "OPTIONS", headers: { Origin: "http://localhost:8081", "Access-Control-Request-Headers": "authorization" } }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
    const refused = await harness.raw(new Request(`${ORIGIN}/api/teams`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
    expect(refused.status).toBe(403);
    const response = await harness.send("GET", "/api/teams", undefined, { headers: { Origin: "http://localhost:8081", Authorization: `Bearer ${app.token}` } });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("are not allowed from other sites", async () => {
    const response = await harness.send("GET", "/api/teams", undefined, { headers: { Origin: "https://evil.example" } });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(new URL(ORIGIN).origin).toBe(ORIGIN);
  });
});

describe("app notifications", () => {
  const TOKEN = "ExponentPushToken[abcdefghijklmnop123456]";

  it("register app devices by Expo push token", async () => {
    const app = await harness.signInApp("alice");
    expect((await app.post("/api/push/native", { token: "https://evil.example", platform: "ios" })).status).toBe(400);
    expect((await app.post("/api/push/native", { token: TOKEN, platform: "windows" })).status).toBe(400);
    expect((await app.post("/api/push/native", { token: TOKEN, platform: "ios" })).status).toBe(201);
    expect(await harness.db.prepare("SELECT COUNT(*) AS n FROM native_push_tokens").first("n")).toBe(1);
    await app.post("/api/push/native/remove", { token: TOKEN });
    expect(await harness.db.prepare("SELECT COUNT(*) AS n FROM native_push_tokens").first("n")).toBe(0);
  });

  it("deliver alerts to app devices, forgetting ones that are gone", async () => {
    const alice = await harness.signInApp("alice");
    const bob = await harness.signInApp("bob");
    const carol = await harness.signInApp("carol");
    const created = await alice.post("/api/events", { name: "Fest" });
    const eventId = created.data.event.id;
    await alice.post(`/api/events/${eventId}/members`, { people: [{ email: bob.email }, { email: carol.email }] });
    await bob.post("/api/push/native", { token: TOKEN, platform: "android" });
    await carol.post("/api/push/native", { token: "ExponentPushToken[GoneGoneGoneGone]", platform: "ios" });

    const sent = await alice.post(`/api/events/${eventId}/alerts`, { title: "Gate", urgency: "page", audience: { type: "everyone" } });
    expect(sent.data.alert.devices).toBe(2);
    await harness.settle();
    expect(harness.appPushes).toHaveLength(1);
    expect(harness.appPushes[0].tokens.sort()).toEqual(["ExponentPushToken[GoneGoneGoneGone]", TOKEN]);
    expect(harness.appPushes[0].options.urgent).toBe(true);
    const left = await harness.db.prepare("SELECT token FROM native_push_tokens").all();
    expect(left.results.map((row) => row.token)).toEqual([TOKEN]);
  });
});

describe("Expo push delivery", () => {
  it("recognises Expo push tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isExpoPushToken("https://exp.host")).toBe(false);
    expect(isExpoPushToken(42)).toBe(false);
  });

  it("sends pages loud and reports unregistered devices", async () => {
    /** @type {any[]} */
    const requests = [];
    vi.stubGlobal("fetch", async (/** @type {string} */ url, /** @type {any} */ init) => {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ data: [{ status: "ok", id: "1" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }), { status: 200 });
    });
    const expired = await sendNativePush(
      { EXPO_ACCESS_TOKEN: "secret" },
      ["ExponentPushToken[aaaaaaaaaaaa]", "ExponentPushToken[bbbbbbbbbbbb]"],
      { id: "a1", eventId: "e1", eventName: "Fest", title: "Gate", body: "Now", urgency: "page", sender: "Alice" },
      { urgent: true, ttlSeconds: 60 },
    );
    vi.unstubAllGlobals();
    expect(expired).toEqual(["ExponentPushToken[bbbbbbbbbbbb]"]);
    expect(requests[0].url).toBe("https://exp.host/--/api/v2/push/send");
    expect(requests[0].init.headers.Authorization).toBe("Bearer secret");
    expect(requests[0].body[0]).toMatchObject({ title: "Gate", body: "Now\nAlice · Fest", priority: "high", channelId: "pages", sound: "default", data: { type: "alert", id: "a1" } });
  });
});
