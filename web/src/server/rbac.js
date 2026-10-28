/**
 * Access rules inside an event. Everything here is a pure function of the person's place in
 * the event, so the rules can be read (and tested) in one spot, apart from the database.
 *
 * Roles:
 * - organizer: runs the event: its details, people, sub-teams, documents, and alerts to anyone.
 *   The event's owner (its creator) is an organizer who can't be removed or demoted, and is
 *   the only one who can delete the event.
 * - member: sees the event, its people and sub-teams, the documents shared with them, and
 *   the alerts sent to them.
 * - manager: a member or organizer marked as manager of a sub-team. Managers can alert (page)
 *   the people in the sub-teams they manage, and nobody else.
 *
 * @typedef {{ email: string, role: "organizer" | "member", isOwner: boolean, manages: string[], subteams: string[] }} EventActor
 * @typedef {{ audience: "everyone" | "organizers" | "subteams", access: "writer" | "reader", createdBy: string, subteamIds: string[] }} DocPolicy
 * @typedef {{ type: "everyone" } | { type: "subteams", subteamIds: string[] } | { type: "people", emails: string[] }} AlertAudience
 */

/** @param {EventActor | null} actor */
export const isOrganizer = (actor) => actor?.role === "organizer";

/** @param {EventActor | null} actor */
export const canManageEvent = (actor) => isOrganizer(actor);

/** @param {EventActor | null} actor */
export const canDeleteEvent = (actor) => Boolean(actor?.isOwner);

/**
 * Whether the actor may change or remove another person's membership. Organizers manage
 * everyone except the owner. Anyone but the owner may remove themselves (leave).
 * @param {EventActor | null} actor
 * @param {{ email: string }} target
 * @param {string} ownerEmail
 * @param {"change" | "remove"} action
 */
export function canChangeMember(actor, target, ownerEmail, action) {
  if (!actor || target.email === ownerEmail) return false;
  if (action === "remove" && target.email === actor.email) return true;
  return isOrganizer(actor);
}

/** @param {EventActor | null} actor */
export const canSendAlerts = (actor) => isOrganizer(actor) || Boolean(actor?.manages.length);

/**
 * Whether the actor can see a document listed in the event.
 * @param {EventActor | null} actor
 * @param {DocPolicy} doc
 */
export function canViewDoc(actor, doc) {
  if (!actor) return false;
  if (isOrganizer(actor) || doc.createdBy === actor.email) return true;
  if (doc.audience === "everyone") return true;
  if (doc.audience === "subteams") return doc.subteamIds.some((id) => actor.subteams.includes(id));
  return false;
}

/**
 * Checks an alert audience against what the actor may page, and returns why not if refused.
 * Organizers may alert anyone in the event; managers only the sub-teams they manage and the
 * people in them.
 * @param {EventActor | null} actor
 * @param {AlertAudience} audience
 * @param {(subteamIds: string[]) => Set<string>} membersOf emails in the given sub-teams
 * @returns {string} empty when allowed
 */
export function alertRefusal(actor, audience, membersOf) {
  if (!actor) return "You are not part of this event.";
  if (isOrganizer(actor)) return "";
  if (!actor.manages.length) return "Only organizers and sub-team managers can send alerts.";
  if (audience.type === "everyone") return "Managers can alert only the sub-teams they manage.";
  if (audience.type === "subteams") {
    return audience.subteamIds.every((id) => actor.manages.includes(id)) ? "" : "Managers can alert only the sub-teams they manage.";
  }
  const reachable = membersOf(actor.manages);
  return audience.emails.every((email) => reachable.has(email)) ? "" : "Managers can alert only people in the sub-teams they manage.";
}

/**
 * Who should have which access to a Linework-managed file. Organizers can always edit; the
 * audience gets the document's access level. The creator owns the file, so needs no grant.
 * @param {DocPolicy} doc
 * @param {Array<{ email: string, role: "organizer" | "member" }>} members
 * @param {(subteamIds: string[]) => Set<string>} membersOf
 * @returns {Map<string, "writer" | "reader">}
 */
export function desiredAccess(doc, members, membersOf) {
  /** @type {Map<string, "writer" | "reader">} */
  const access = new Map();
  const audience =
    doc.audience === "everyone" ? new Set(members.map((member) => member.email)) : doc.audience === "subteams" ? membersOf(doc.subteamIds) : new Set();
  for (const member of members) {
    if (member.email === doc.createdBy) continue;
    if (member.role === "organizer") access.set(member.email, "writer");
    else if (audience.has(member.email)) access.set(member.email, doc.access);
  }
  return access;
}

/**
 * The Drive permission changes that bring a file's sharing in line with `desired`. A share
 * that failed before (for example an address with no Google account) is retried only when
 * asked, so it doesn't count as pending forever.
 * @param {Map<string, "writer" | "reader">} desired
 * @param {Array<{ email: string, role: "writer" | "reader", permissionId: string, status: "shared" | "failed" }>} grants
 * @param {{ retryFailed?: boolean }} [options]
 */
export function sharingPlan(desired, grants, { retryFailed = false } = {}) {
  const byEmail = new Map(grants.map((grant) => [grant.email, grant]));
  /** @type {Array<{ email: string, role: "writer" | "reader", permissionId: string }>} */
  const share = [];
  /** @type {Array<{ email: string, permissionId: string }>} */
  const revoke = [];
  for (const [email, role] of desired) {
    const grant = byEmail.get(email);
    if (grant?.role === role && (grant.status === "shared" || !retryFailed)) continue;
    share.push({ email, role, permissionId: grant?.status === "shared" ? grant.permissionId : "" });
  }
  for (const grant of grants) {
    // A failed share left nothing in Drive, so its record is simply dropped.
    if (!desired.has(grant.email)) revoke.push({ email: grant.email, permissionId: grant.status === "shared" ? grant.permissionId : "" });
  }
  return { share, revoke };
}
