import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { displayName } from "../../lib/people.js";
import { useStore } from "../../lib/store.js";
import { TOUCH, colors, fonts, radius } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Pill } from "../ui/Pill.js";
import { Select } from "../ui/Select.js";
import { Text } from "../ui/Text.js";
import { AddPeopleSheet } from "./AddPeopleSheet.js";

/** @typedef {import("../../stores/events.js").EventMember} EventMember */

/** Everyone in the event, with roles; organizers can add, promote, and remove people. */
export function EventPeople() {
  useStore(events);
  const detail = events.detail;
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const managing = useMemo(() => {
    /** @type {Map<string, string[]>} */
    const map = new Map();
    for (const subteam of detail?.subteams ?? []) for (const member of subteam.members) if (member.isManager) map.set(member.email, [...(map.get(member.email) ?? []), subteam.name]);
    return map;
  }, [detail]);
  if (!detail) return null;
  const { me } = detail;
  const term = query.trim().toLowerCase();
  const shown = term ? detail.members.filter((member) => member.email.includes(term) || member.name.toLowerCase().includes(term)) : detail.members;

  /** @param {Array<{ email: string, name: string }>} people @param {"organizer" | "member"} role */
  async function add(people, role) {
    await events.addPeople(people, role);
    toast.show(`${pluralize(people.length, "person", "people")} added. Shared documents will reach them shortly.`);
  }

  /** @param {EventMember} member @param {"organizer" | "member"} role */
  async function setRole(member, role) {
    if (role === member.role) return;
    if (member.email === me.email && role === "member") {
      const confirmed = await dialogs.confirm({ title: "Stop being an organizer?", message: "You won't be able to manage this event any more unless another organizer makes you one again.", confirmLabel: "Become a member", danger: true });
      if (!confirmed) return;
    }
    await attempt(() => events.setRole(member.email, role), "Could not change the role");
  }

  /** @param {EventMember} member */
  async function remove(member) {
    const confirmed = await dialogs.confirm({
      title: `Remove ${displayName(member)}?`,
      message: "They leave the event and its sub-teams, stop receiving its alerts, and lose access to documents Linework shared with them.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (confirmed) await attempt(() => events.removePerson(member.email), "Could not remove the person");
  }

  return (
    <View style={styles.section}>
      {me.canManage ? <Button variant="primary" label="Add people" onPress={() => setAdding(true)} /> : null}
      <TextInput value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={colors.placeholder} accessibilityLabel="Search people" autoCapitalize="none" style={styles.search} />
      {shown.map((member) => (
        <View key={member.email} style={styles.person}>
          <Text weight="semibold">{`${displayName(member)}${member.email === me.email ? " (you)" : ""}`}</Text>
          {member.name ? (
            <Text variant="small" muted>
              {member.email}
            </Text>
          ) : null}
          <View style={styles.tags}>
            {member.isOwner ? <Pill label="Owner" tone="accent" /> : member.role === "organizer" ? <Pill label="Organizer" tone="accent" /> : null}
            {(managing.get(member.email) ?? []).map((name) => (
              <Pill key={name} label={`Manager · ${name}`} />
            ))}
            {!member.hasAccount ? (
              <Text variant="small" muted>
                Hasn't signed in to Linework yet
              </Text>
            ) : null}
          </View>
          {me.canManage && !member.isOwner ? (
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Select
                  label={`Role for ${displayName(member)}`}
                  hideLabel
                  value={member.role}
                  options={[
                    { value: "member", label: "Member" },
                    { value: "organizer", label: "Organizer" },
                  ]}
                  onChange={(role) => setRole(member, role)}
                />
              </View>
              <Button variant="quiet" textColor={colors.danger} label="Remove" accessibilityLabel={`Remove ${displayName(member)}`} onPress={() => remove(member)} />
            </View>
          ) : null}
        </View>
      ))}
      {!shown.length ? <Text muted>No one matches that search.</Text> : null}
      {adding ? (
        <AddPeopleSheet
          title={`Add people to ${detail.event.name}`}
          description="They'll see the event in Linework when they sign in with these Google accounts, and get the documents and alerts meant for them."
          withRole
          onSave={add}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  search: {
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: radius.small,
    backgroundColor: colors.field,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  person: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  flex: {
    flex: 1,
  },
});
