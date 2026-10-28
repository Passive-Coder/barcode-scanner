import { api } from "../lib/api/client.js";
import { Store } from "../lib/store.js";

/**
 * The signed-in person's teams: their own lists of known people (name and email), like a Google
 * Group, for adding people to events and sub-teams quickly. (Mirrors teams.svelte.js.)
 *
 * @typedef {{ id: string, name: string, description: string, created_at: number, updated_at: number, member_count: number }} TeamSummary
 * @typedef {{ email: string, name: string, added_at: number }} TeamMember
 */
class TeamStore extends Store {
  /** @type {TeamSummary[]} */
  list = [];
  loaded = false;
  selectedId = "";
  /** @type {{ team: Omit<TeamSummary, "member_count">, members: TeamMember[] } | null} */
  detail = null;

  async load() {
    const { teams } = await api.get("/teams");
    this.list = teams;
    this.loaded = true;
    if (this.selectedId && !teams.some((/** @type {TeamSummary} */ team) => team.id === this.selectedId)) {
      this.selectedId = "";
      this.detail = null;
    }
    this.changed();
  }

  /** @param {string} id */
  async open(id) {
    this.selectedId = id;
    if (this.detail?.team.id !== id) this.detail = null;
    this.changed();
    const detail = await api.get(`/teams/${encodeURIComponent(id)}`);
    if (this.selectedId === id) {
      this.detail = detail;
      this.changed();
    }
    return detail;
  }

  /** Loads a team's members without changing the selection (for adding a team to an event). @param {string} id */
  async members(id) {
    const { members } = await api.get(`/teams/${encodeURIComponent(id)}`);
    return /** @type {TeamMember[]} */ (members);
  }

  /** @param {string} name @param {string} description */
  async create(name, description) {
    const { team } = await api.post("/teams", { name, description });
    await this.load();
    await this.open(team.id);
    return /** @type {TeamSummary} */ (team);
  }

  /** @param {{ name?: string, description?: string }} changes */
  async update(changes) {
    const id = this.selectedId;
    await api.patch(`/teams/${encodeURIComponent(id)}`, changes);
    await Promise.all([this.load(), this.open(id)]);
  }

  async remove() {
    const id = this.selectedId;
    await api.delete(`/teams/${encodeURIComponent(id)}`);
    this.close();
    await this.load();
  }

  /** @param {Array<{ email: string, name: string }>} people */
  async addPeople(people) {
    const id = this.selectedId;
    const { members } = await api.post(`/teams/${encodeURIComponent(id)}/members`, { people });
    if (this.detail && this.selectedId === id) {
      this.detail = { ...this.detail, members };
      this.changed();
    }
    await this.load();
  }

  /** @param {string} email */
  async removePerson(email) {
    const id = this.selectedId;
    await api.delete(`/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(email)}`);
    if (this.detail && this.selectedId === id) {
      this.detail = { ...this.detail, members: this.detail.members.filter((member) => member.email !== email) };
      this.changed();
    }
    await this.load();
  }

  close() {
    this.selectedId = "";
    this.detail = null;
    this.changed();
  }

  reset() {
    this.list = [];
    this.loaded = false;
    this.close();
  }
}

export const teams = new TeamStore();
