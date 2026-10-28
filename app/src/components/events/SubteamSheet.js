import { useEffect, useMemo, useState } from "react";
import { errorMessage, pluralize } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { events } from "../../stores/events.js";
import { teams } from "../../stores/teams.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { PeoplePicker } from "../ui/PeoplePicker.js";
import { Select } from "../ui/Select.js";
import { Sheet } from "../ui/Sheet.js";
import { Text } from "../ui/Text.js";
import { TextField } from "../ui/TextField.js";

/**
 * Creates or edits a sub-team: its name, its people, and which of them manage it. People can be
 * picked from the event, or filled in from one of your teams (anyone not yet in the event is
 * added to it as a member). (Mirrors the website's SubteamDialog.)
 * @param {{ subteam: import("../../stores/events.js").Subteam | null, onClose: () => void }} props
 */
export function SubteamSheet({ subteam, onClose }) {
  useStore(events);
  useStore(teams);
  const detail = events.detail;
  const [name, setName] = useState(subteam?.name ?? "");
  const [members, setMembers] = useState(/** @type {string[]} */ (subteam?.members.map((member) => member.email) ?? []));
  const [managers, setManagers] = useState(/** @type {string[]} */ (subteam?.members.filter((member) => member.isManager).map((member) => member.email) ?? []));
  /** People from a team who aren't in the event yet; they're added to it on save. */
  const [newcomers, setNewcomers] = useState(/** @type {Array<{ email: string, name: string }>} */ ([]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Newcomers join the event on save, so the event's own list takes over from then on.
  const people = useMemo(() => {
    const inEvent = (detail?.members ?? []).map((member) => ({ email: member.email, name: member.name }));
    const known = new Set(inEvent.map((member) => member.email));
    return [...inEvent, ...newcomers.filter((person) => !known.has(person.email))];
  }, [detail, newcomers]);
  const joining = newcomers.filter((person) => members.includes(person.email));

  useEffect(() => {
    if (account.ready && !teams.loaded) teams.load().catch((failure) => console.warn("Could not load teams.", failure));
  }, []);

  /** @param {string} teamId */
  async function fillFromTeam(teamId) {
    setError("");
    try {
      const teamMembers = await teams.members(teamId);
      const known = new Set(people.map((person) => person.email));
      setNewcomers((current) => [...current, ...teamMembers.filter((member) => !known.has(member.email)).map((member) => ({ email: member.email, name: member.name }))]);
      setMembers((current) => [...new Set([...current, ...teamMembers.map((member) => member.email)])]);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function submit() {
    if (busy) return;
    setError("");
    if (!name.trim()) return setError("Give the sub-team a name.");
    setBusy(true);
    try {
      if (joining.length) await events.addPeople(joining, "member");
      await events.saveSubteam(subteam?.id ?? null, { name: name.trim(), members, managers });
      toast.show(subteam ? "Sub-team saved" : `Sub-team created${joining.length ? `; ${pluralize(joining.length, "person", "people")} added to the event` : ""}`);
      onClose();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible
      title={subteam ? `Edit “${subteam.name}”` : "New sub-team"}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="primary" busy={busy} label={busy ? "Saving…" : subteam ? "Save sub-team" : "Create sub-team"} onPress={submit} />
        </>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Logistics" editable={!busy} autoFocus={!subteam} />
      {teams.list.length ? (
        <Select label="Fill from a team" value="" placeholder="Choose a team…" disabled={busy} options={teams.list.map((team) => ({ value: team.id, label: `${team.name} (${team.member_count})` }))} onChange={fillFromTeam} />
      ) : null}
      <PeoplePicker label="People and managers" people={people} selected={members} onChange={setMembers} managers={managers} onManagersChange={setManagers} />
      {joining.length ? (
        <Text variant="small" muted>{`${pluralize(joining.length, "person", "people")} from the team will also be added to the event as ${joining.length === 1 ? "a member" : "members"}.`}</Text>
      ) : null}
      <Text variant="small" muted>
        Managers can page this sub-team's members and see who has acknowledged.
      </Text>
      {error ? (
        <Text weight="semibold" color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
