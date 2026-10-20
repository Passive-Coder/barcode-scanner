import { api } from "../api/client.js";

/**
 * The signed-in person's teams: their own lists of known people (name and email), like a
 * Google Group, for adding people to events and sub-teams quickly.
 *
 * @typedef {{ id: string, name: string, description: string, created_at: number, updated_at: number, member_count: number }} TeamSummary
 * @typedef {{ email: string, name: string, added_at: number }} TeamMember
 */
class TeamStore {
  /** @type {TeamSummary[]} */
  list = $state.raw([]);
  loaded = $state(false);
  selectedId = $state("");
  /** @type {{ team: Omit<TeamSummary, "member_count">, members: TeamMember[] } | null} */
  detail = $state.raw(null);

  async load() {
    const { teams } = await api.get("/teams");
    this.list = teams;
    this.loaded = true;
    if (this.selectedId && !teams.some((/** @type {TeamSummary} */ team) => team.id === this.selectedId)) {
      this.selectedId = "";
      this.detail = null;
    }
  }

  /** @param {string} id */
  async open(id) {
    this.selectedId = id;
    if (this.detail?.team.id !== id) this.detail = null;
    const detail = await api.get(`/teams/${encodeURIComponent(id)}`);
    if (this.selectedId === id) this.detail = detail;
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
    return team;
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
    this.selectedId = "";
    this.detail = null;
    await this.load();
  }

  /** @param {Array<{ email: string, name: string }>} people */
  async addPeople(people) {
    const id = this.selectedId;
    const { members } = await api.post(`/teams/${encodeURIComponent(id)}/members`, { people });
    if (this.detail && this.selectedId === id) this.detail = { ...this.detail, members };
    await this.load();
  }

  /** @param {string} email */
  async removePerson(email) {
    const id = this.selectedId;
    await api.delete(`/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(email)}`);
    if (this.detail && this.selectedId === id) this.detail = { ...this.detail, members: this.detail.members.filter((member) => member.email !== email) };
    await this.load();
  }

  reset() {
    this.list = [];
    this.loaded = false;
    this.selectedId = "";
    this.detail = null;
  }
}

export const teams = new TeamStore();
