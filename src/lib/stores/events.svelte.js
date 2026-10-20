import { api } from "../api/client.js";
import { errorMessage } from "../format.js";
import { DRIVE_FILE_SCOPE, DriveNotFoundError, DriveScopeError, parseFileLink } from "../google/drive-client.js";
import { isRetryable } from "../google/sheets-client.js";
import { drive } from "../google/sheets.js";
import { auth } from "./auth.svelte.js";

/**
 * Events: groups of people with roles (organizers, members, and sub-team managers), the
 * Google Sheets and Docs they work on, and the alerts sent to them. The server enforces every
 * permission; this store mirrors what the server says the person may do so the UI can match.
 *
 * @typedef {{ id: string, name: string, description: string, role: "organizer" | "member", isOwner: boolean, isManager: boolean, memberCount: number, createdAt: number }} EventSummary
 * @typedef {{ email: string, name: string, role: "organizer" | "member", isOwner: boolean, hasAccount: boolean, addedAt: number }} EventMember
 * @typedef {{ id: string, name: string, members: Array<{ email: string, isManager: boolean }> }} Subteam
 * @typedef {"everyone" | "organizers" | "subteams"} DocAudience
 * @typedef {{
 *   id: string, kind: "sheet" | "doc", fileId: string, title: string, managed: boolean,
 *   audience: DocAudience, access: "writer" | "reader", myAccess: "writer" | "reader",
 *   subteamIds: string[], createdBy: string, createdAt: number,
 *   sharing?: { shared: number, pending: number, failed: Array<{ email: string, error: string }> },
 * }} EventDoc
 * @typedef {{
 *   event: { id: string, name: string, description: string, ownerEmail: string, createdAt: number },
 *   me: { email: string, role: "organizer" | "member", isOwner: boolean, manages: string[], subteams: string[], canManage: boolean, canDelete: boolean, canSendAlerts: boolean },
 *   members: EventMember[],
 *   subteams: Subteam[],
 *   docs: EventDoc[],
 * }} EventDetail
 * @typedef {{ kind: "sheet" | "doc", title: string, audience: DocAudience, access: "writer" | "reader", subteamIds: string[] }} DocSettings
 * @typedef {import("./alerts.svelte.js").Alert} Alert
 * @typedef {{ type: "everyone" } | { type: "subteams", subteamIds: string[] } | { type: "people", emails: string[] }} AlertAudience
 */

/** @param {string} id */
const path = (id) => `/events/${encodeURIComponent(id)}`;

class EventStore {
  /** @type {EventSummary[]} */
  list = $state.raw([]);
  loaded = $state(false);
  selectedId = $state("");
  /** @type {EventDetail | null} */
  detail = $state.raw(null);
  /** @type {Alert[]} alerts in the open event that this person may see */
  alerts = $state.raw([]);
  /** Documents whose sharing is being updated right now. */
  syncing = $state.raw(/** @type {string[]} */ ([]));

  /** @param {EventDetail} detail */
  #apply(detail) {
    if (detail.event.id === this.selectedId) this.detail = detail;
    return detail;
  }

  #requireDetail() {
    if (!this.detail) throw new Error("Open an event first.");
    return this.detail;
  }

  async load() {
    const { events } = await api.get("/events");
    this.list = events;
    this.loaded = true;
  }

  /** @param {string} id */
  async open(id) {
    this.selectedId = id;
    if (this.detail?.event.id !== id) {
      this.detail = null;
      this.alerts = [];
    }
    const detail = await api.get(path(id));
    this.#apply(detail);
    void this.loadAlerts().catch((error) => console.warn("Could not load the event's alerts.", error));
    void this.#syncOwnDocs(detail);
    return detail;
  }

  close() {
    this.selectedId = "";
    this.detail = null;
    this.alerts = [];
  }

  /** @param {string} name @param {string} description */
  async create(name, description) {
    const detail = await api.post("/events", { name, description });
    this.selectedId = detail.event.id;
    this.#apply(detail);
    this.alerts = [];
    await this.load();
    return detail;
  }

  /** @param {{ name?: string, description?: string }} changes */
  async update(changes) {
    const { event } = this.#requireDetail();
    this.#apply(await api.patch(path(event.id), changes));
    await this.load();
  }

  async remove() {
    const { event } = this.#requireDetail();
    await api.delete(path(event.id));
    this.close();
    await this.load();
  }

  /** @param {Array<{ email: string, name: string }>} people @param {"organizer" | "member"} role */
  async addPeople(people, role) {
    const { event } = this.#requireDetail();
    const detail = this.#apply(await api.post(`${path(event.id)}/members`, { people, role }));
    void this.#syncOwnDocs(detail);
    void this.load();
  }

  /** @param {string} email @param {"organizer" | "member"} role */
  async setRole(email, role) {
    const { event } = this.#requireDetail();
    const detail = this.#apply(await api.patch(`${path(event.id)}/members/${encodeURIComponent(email)}`, { role }));
    void this.#syncOwnDocs(detail);
    void this.load();
  }

  /** @param {string} email */
  async removePerson(email) {
    const { event } = this.#requireDetail();
    const result = await api.delete(`${path(event.id)}/members/${encodeURIComponent(email)}`);
    if (result.left) {
      this.close();
    } else {
      void this.#syncOwnDocs(this.#apply(result));
    }
    await this.load();
  }

  /**
   * Creates or updates a sub-team.
   * @param {string | null} subteamId
   * @param {{ name: string, members: string[], managers: string[] }} subteam
   */
  async saveSubteam(subteamId, subteam) {
    const { event } = this.#requireDetail();
    const detail = this.#apply(
      subteamId ? await api.patch(`${path(event.id)}/subteams/${encodeURIComponent(subteamId)}`, subteam) : await api.post(`${path(event.id)}/subteams`, subteam),
    );
    void this.#syncOwnDocs(detail);
  }

  /** @param {string} subteamId */
  async deleteSubteam(subteamId) {
    const { event } = this.#requireDetail();
    void this.#syncOwnDocs(this.#apply(await api.delete(`${path(event.id)}/subteams/${encodeURIComponent(subteamId)}`)));
  }

  /**
   * Creates a Google Sheet or Doc in the organizer's Drive, lists it in the event, and shares
   * it with the people it's for. Run from a click: Google may ask to allow Drive access.
   * @param {DocSettings} settings
   */
  async createDoc({ kind, title, audience, access, subteamIds }) {
    const { event } = this.#requireDetail();
    await auth.grant(DRIVE_FILE_SCOPE);
    const file = await drive.createFile(kind, title);
    let result;
    try {
      result = await api.post(`${path(event.id)}/docs`, { kind, fileId: file.id, title, managed: true, audience, access, subteamIds });
    } catch (error) {
      throw new Error(`“${title}” was created in your Google Drive, but couldn't be added to the event: ${errorMessage(error)}`);
    }
    this.#apply(result);
    return { docId: /** @type {string} */ (result.docId), sharing: await this.syncSharing(event.id, result.docId) };
  }

  /**
   * Lists an existing Google Sheet or Doc. Its sharing stays as its owner set it.
   * @param {{ link: string } & DocSettings} settings
   */
  async linkDoc({ link, kind, title, audience, access, subteamIds }) {
    const { event } = this.#requireDetail();
    const parsed = parseFileLink(link);
    this.#apply(await api.post(`${path(event.id)}/docs`, { kind: parsed.kind ?? kind, fileId: parsed.fileId, title, managed: false, audience, access, subteamIds }));
  }

  /** @param {string} docId @param {Partial<DocSettings>} changes */
  async updateDoc(docId, changes) {
    const { event } = this.#requireDetail();
    const detail = this.#apply(await api.patch(`${path(event.id)}/docs/${encodeURIComponent(docId)}`, changes));
    void this.#syncOwnDocs(detail);
  }

  /** @param {string} docId */
  async removeDoc(docId) {
    const { event } = this.#requireDetail();
    this.#apply(await api.delete(`${path(event.id)}/docs/${encodeURIComponent(docId)}`));
  }

  /**
   * Brings a file's Google Drive sharing in line with the event. Only the file's creator can,
   * since Linework's Drive access covers only files it created for them.
   * @param {string} eventId @param {string} docId @param {{ retry?: boolean }} [options]
   * @returns {Promise<{ shared: number, failed: number, revoked: number }>}
   */
  async syncSharing(eventId, docId, { retry = false } = {}) {
    if (this.syncing.includes(docId)) return { shared: 0, failed: 0, revoked: 0 };
    this.syncing = [...this.syncing, docId];
    /** @type {Array<{ email: string, role: "writer" | "reader", permissionId?: string, status: "shared" | "failed", error?: string }>} */
    const results = [];
    /** @type {string[]} */
    const revoked = [];
    try {
      const plan = await api.get(`${path(eventId)}/docs/${encodeURIComponent(docId)}/sharing${retry ? "?retry=1" : ""}`);
      try {
        for (const item of plan.share) {
          try {
            let permissionId = item.permissionId;
            if (permissionId) {
              try {
                await drive.updatePermission(plan.fileId, permissionId, item.role);
              } catch (error) {
                // Someone removed the access in Google Drive; share it again.
                if (!(error instanceof DriveNotFoundError)) throw error;
                permissionId = await drive.share(plan.fileId, item.email, item.role);
              }
            } else {
              permissionId = await drive.share(plan.fileId, item.email, item.role);
            }
            results.push({ email: item.email, role: item.role, permissionId, status: "shared" });
          } catch (error) {
            if (isRetryable(error) || error instanceof DriveScopeError) throw error;
            results.push({ email: item.email, role: item.role, status: "failed", error: errorMessage(error).slice(0, 300) });
          }
        }
        for (const item of plan.revoke) {
          if (item.permissionId) {
            try {
              await drive.revoke(plan.fileId, item.permissionId);
            } catch (error) {
              if (!(error instanceof DriveNotFoundError)) throw error;
            }
          }
          revoked.push(item.email);
        }
      } finally {
        // Whatever was done in Drive is recorded, even if the rest has to wait.
        if (results.length || revoked.length) await api.post(`${path(eventId)}/docs/${encodeURIComponent(docId)}/sharing`, { results, revoked });
      }
      return { shared: results.filter((result) => result.status === "shared").length, failed: results.filter((result) => result.status === "failed").length, revoked: revoked.length };
    } finally {
      this.syncing = this.syncing.filter((id) => id !== docId);
      if (this.selectedId === eventId) {
        const detail = await api.get(path(eventId)).catch(() => null);
        if (detail) this.#apply(detail);
      }
    }
  }

  /**
   * Updates sharing for files this person created whose access is out of date. It runs in the
   * background, so it needs Drive access the person already granted; otherwise organizers see
   * a "Share now" button.
   * @param {EventDetail} detail
   */
  async #syncOwnDocs(detail) {
    if (!auth.hasScope(DRIVE_FILE_SCOPE)) return;
    for (const doc of detail.docs) {
      if (!doc.managed || doc.createdBy !== detail.me.email || !doc.sharing?.pending) continue;
      await this.syncSharing(detail.event.id, doc.id).catch((error) => console.warn(`Could not update sharing for “${doc.title}”.`, error));
    }
  }

  /** After sign-in: update sharing for files in any event, so people get access promptly. */
  async syncPendingSharing() {
    if (!auth.hasScope(DRIVE_FILE_SCOPE)) return;
    try {
      const { pending } = await api.get("/sharing/pending");
      for (const item of pending) await this.syncSharing(item.eventId, item.docId).catch((error) => console.warn(`Could not update sharing for “${item.title}”.`, error));
    } catch (error) {
      console.warn("Could not check for documents waiting to be shared.", error);
    }
  }

  async loadAlerts() {
    const id = this.selectedId;
    if (!id) return;
    const { alerts } = await api.get(`${path(id)}/alerts`);
    if (this.selectedId === id) this.alerts = alerts;
  }

  /**
   * @param {{ title: string, body: string, urgency: "notice" | "page", audience: AlertAudience }} alert
   * @returns {Promise<Alert & { devices: number }>}
   */
  async sendAlert(alert) {
    const { event } = this.#requireDetail();
    const { alert: sent } = await api.post(`${path(event.id)}/alerts`, alert);
    if (this.selectedId === event.id) this.alerts = [sent, ...this.alerts];
    return sent;
  }

  /** @param {string} alertId */
  async alertRecipients(alertId) {
    const { event } = this.#requireDetail();
    const { recipients } = await api.get(`${path(event.id)}/alerts/${encodeURIComponent(alertId)}`);
    return /** @type {Array<{ email: string, name: string, acknowledgedAt: number | null }>} */ (recipients);
  }

  reset() {
    this.list = [];
    this.loaded = false;
    this.close();
  }
}

export const events = new EventStore();
