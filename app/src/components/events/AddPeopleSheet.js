import { useEffect, useState } from "react";
import { errorMessage, pluralize } from "../../lib/format.js";
import { parsePeople } from "../../lib/people.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { teams } from "../../stores/teams.js";
import { Button } from "../ui/Button.js";
import { RadioGroup } from "../ui/Choice.js";
import { Select } from "../ui/Select.js";
import { Sheet } from "../ui/Sheet.js";
import { Text } from "../ui/Text.js";
import { TextField } from "../ui/TextField.js";

/**
 * Adds people by email: typed or pasted, or copied in from one of your teams.
 * @param {{
 *   title: string,
 *   description?: string,
 *   withRole?: boolean,
 *   excludeTeamId?: string,
 *   onSave: (people: Array<{ email: string, name: string }>, role: "organizer" | "member") => Promise<void>,
 *   onClose: () => void,
 * }} props
 */
export function AddPeopleSheet({ title, description, withRole = false, excludeTeamId = "", onSave, onClose }) {
  useStore(teams);
  const [text, setText] = useState("");
  const [role, setRole] = useState(/** @type {"organizer" | "member"} */ ("member"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const parsed = parsePeople(text);
  const teamChoices = teams.list.filter((team) => team.id !== excludeTeamId && team.member_count > 0);

  useEffect(() => {
    if (account.ready && !teams.loaded) teams.load().catch((failure) => console.warn("Could not load teams.", failure));
  }, []);

  /** @param {string} teamId */
  async function addTeam(teamId) {
    // Errors show in the sheet: a toast would be hidden behind it.
    setError("");
    try {
      const members = await teams.members(teamId);
      const lines = members.map((member) => (member.name ? `${member.name} <${member.email}>` : member.email));
      setText((current) => [current.trim(), ...lines].filter(Boolean).join("\n"));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function submit() {
    if (busy) return;
    setError("");
    if (parsed.invalid.length) return setError(`These aren't email addresses: ${parsed.invalid.slice(0, 3).join(", ")}${parsed.invalid.length > 3 ? "…" : ""}`);
    if (!parsed.people.length) return setError("Add at least one email address.");
    setBusy(true);
    try {
      await onSave(parsed.people, role);
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
      title={title}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button label="Cancel" disabled={busy} onPress={onClose} />
          <Button variant="primary" busy={busy} label={busy ? "Adding…" : parsed.people.length ? `Add ${pluralize(parsed.people.length, "person", "people")}` : "Add people"} onPress={submit} />
        </>
      }
    >
      {description ? <Text muted>{description}</Text> : null}
      <TextField
        label="Emails"
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={"Ann Lee <ann@example.com>\nben@example.com"}
        hint={`One per line, or separated by commas. Names are optional.${parsed.people.length ? ` ${pluralize(parsed.people.length, "person", "people")} to add.` : ""}`}
        autoFocus
      />
      {teamChoices.length ? (
        <Select label="Copy from a team" value="" placeholder="Choose a team…" disabled={busy} options={teamChoices.map((team) => ({ value: team.id, label: `${team.name} (${team.member_count})` }))} onChange={addTeam} />
      ) : null}
      {withRole ? (
        <RadioGroup
          label="Add as"
          value={role}
          onChange={setRole}
          options={[
            { value: "member", label: "Members", description: "See the event and what's shared with them" },
            { value: "organizer", label: "Organizers", description: "Manage the event, its people, documents, and alerts" },
          ]}
        />
      ) : null}
      {error ? (
        <Text weight="semibold" color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
