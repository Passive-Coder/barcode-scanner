import { describe, expect, it } from "vitest";
import { alertRefusal, canChangeMember, canDeleteEvent, canManageEvent, canSendAlerts, canViewDoc, desiredAccess, sharingPlan } from "./rbac.js";

/** @param {Partial<import("./rbac.js").EventActor>} [overrides] @returns {import("./rbac.js").EventActor} */
const actor = (overrides = {}) => ({ email: "me@example.com", role: "member", isOwner: false, manages: [], subteams: [], ...overrides });

/** @param {Record<string, string[]>} table */
const membersOf = (table) => (/** @type {string[]} */ ids) => new Set(ids.flatMap((id) => table[id] ?? []));

describe("event roles", () => {
  it("lets organizers manage the event and only the owner delete it", () => {
    expect(canManageEvent(actor({ role: "organizer" }))).toBe(true);
    expect(canManageEvent(actor())).toBe(false);
    expect(canDeleteEvent(actor({ role: "organizer" }))).toBe(false);
    expect(canDeleteEvent(actor({ role: "organizer", isOwner: true }))).toBe(true);
    expect(canManageEvent(null)).toBe(false);
  });

  it("protects the owner and lets anyone else leave", () => {
    const organizer = actor({ role: "organizer" });
    expect(canChangeMember(organizer, { email: "owner@example.com" }, "owner@example.com", "remove")).toBe(false);
    expect(canChangeMember(organizer, { email: "someone@example.com" }, "owner@example.com", "change")).toBe(true);
    expect(canChangeMember(actor(), { email: "someone@example.com" }, "owner@example.com", "remove")).toBe(false);
    expect(canChangeMember(actor(), { email: "me@example.com" }, "owner@example.com", "remove")).toBe(true);
    expect(canChangeMember(actor(), { email: "me@example.com" }, "owner@example.com", "change")).toBe(false);
  });

  it("lets organizers and managers send alerts", () => {
    expect(canSendAlerts(actor())).toBe(false);
    expect(canSendAlerts(actor({ manages: ["team-a"] }))).toBe(true);
    expect(canSendAlerts(actor({ role: "organizer" }))).toBe(true);
  });
});

describe("alert audiences", () => {
  const teams = membersOf({ "team-a": ["ann@example.com", "me@example.com"], "team-b": ["bob@example.com"] });

  it("lets organizers alert anyone", () => {
    expect(alertRefusal(actor({ role: "organizer" }), { type: "everyone" }, teams)).toBe("");
  });

  it("limits managers to the sub-teams they manage and the people in them", () => {
    const manager = actor({ manages: ["team-a"] });
    expect(alertRefusal(manager, { type: "subteams", subteamIds: ["team-a"] }, teams)).toBe("");
    expect(alertRefusal(manager, { type: "people", emails: ["ann@example.com"] }, teams)).toBe("");
    expect(alertRefusal(manager, { type: "everyone" }, teams)).toMatch(/only the sub-teams/);
    expect(alertRefusal(manager, { type: "subteams", subteamIds: ["team-a", "team-b"] }, teams)).toMatch(/only the sub-teams/);
    expect(alertRefusal(manager, { type: "people", emails: ["bob@example.com"] }, teams)).toMatch(/only people/);
  });

  it("refuses members and outsiders", () => {
    expect(alertRefusal(actor(), { type: "people", emails: ["ann@example.com"] }, teams)).toMatch(/Only organizers/);
    expect(alertRefusal(null, { type: "everyone" }, teams)).toMatch(/not part/);
  });
});

describe("document access", () => {
  /** @type {import("./rbac.js").DocPolicy} */
  const subteamDoc = { audience: "subteams", access: "reader", createdBy: "owner@example.com", subteamIds: ["team-a"] };

  it("shows documents to their audience, organizers, and their creator", () => {
    expect(canViewDoc(actor({ subteams: ["team-a"] }), subteamDoc)).toBe(true);
    expect(canViewDoc(actor({ subteams: ["team-b"] }), subteamDoc)).toBe(false);
    expect(canViewDoc(actor({ role: "organizer" }), subteamDoc)).toBe(true);
    expect(canViewDoc(actor({ email: "owner@example.com" }), subteamDoc)).toBe(true);
    expect(canViewDoc(actor(), { ...subteamDoc, audience: "everyone" })).toBe(true);
    expect(canViewDoc(actor(), { ...subteamDoc, audience: "organizers" })).toBe(false);
  });

  it("grants organizers edit access and the audience the document's access", () => {
    const members = /** @type {const} */ ([
      { email: "owner@example.com", role: "organizer" },
      { email: "org@example.com", role: "organizer" },
      { email: "ann@example.com", role: "member" },
      { email: "bob@example.com", role: "member" },
    ]);
    const access = desiredAccess(subteamDoc, [...members], membersOf({ "team-a": ["ann@example.com", "org@example.com"] }));
    expect(Object.fromEntries(access)).toEqual({ "org@example.com": "writer", "ann@example.com": "reader" });
    const everyone = desiredAccess({ ...subteamDoc, audience: "everyone", access: "writer" }, [...members], membersOf({}));
    expect(Object.fromEntries(everyone)).toEqual({ "org@example.com": "writer", "ann@example.com": "writer", "bob@example.com": "writer" });
  });

  it("plans the Drive changes that bring sharing up to date", () => {
    const desired = new Map(/** @type {const} */ ([["ann@example.com", "reader"], ["bob@example.com", "writer"], ["cat@example.com", "reader"]]));
    const plan = sharingPlan(desired, [
      { email: "ann@example.com", role: "reader", permissionId: "p1", status: "shared" },
      { email: "bob@example.com", role: "reader", permissionId: "p2", status: "shared" },
      { email: "cat@example.com", role: "reader", permissionId: "", status: "failed" },
      { email: "old@example.com", role: "reader", permissionId: "p4", status: "shared" },
    ]);
    expect(plan.share).toEqual([{ email: "bob@example.com", role: "writer", permissionId: "p2" }]);
    expect(plan.revoke).toEqual([{ email: "old@example.com", permissionId: "p4" }]);
    const retry = sharingPlan(desired, [{ email: "cat@example.com", role: "reader", permissionId: "", status: "failed" }], { retryFailed: true });
    expect(retry.share.map((item) => item.email)).toEqual(["ann@example.com", "bob@example.com", "cat@example.com"]);
  });
});
