import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { displayName } from "../../lib/people.js";
import { useStore } from "../../lib/store.js";
import { TOUCH, colors, fonts, radius } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { teams } from "../../stores/teams.js";
import { toast } from "../../stores/toast.js";
import { AddPeopleSheet } from "../events/AddPeopleSheet.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Text } from "../ui/Text.js";

/**
 * One team: its people (names and emails), with ways to add, remove, rename, and delete.
 * @param {{ onClosed: () => void }} props
 */
export function TeamDetail({ onClosed }) {
  useStore(teams);
  const detail = teams.detail;
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  if (!detail) return <Text muted>Loading team…</Text>;
  const term = query.trim().toLowerCase();
  const shown = term ? detail.members.filter((member) => member.email.includes(term) || member.name.toLowerCase().includes(term)) : detail.members;

  function edit() {
    if (!detail) return;
    dialogs.edit({
      title: "Edit team",
      submitLabel: "Save",
      fields: [
        { label: "Team name", value: detail.team.name },
        { label: "Description (optional)", value: detail.team.description },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the team a name.");
        await teams.update({ name: name.trim(), description: description.trim() });
      },
    });
  }

  async function remove() {
    if (!detail) return;
    const confirmed = await dialogs.confirm({
      title: `Delete “${detail.team.name}”?`,
      message: "The list is deleted. Events and sub-teams you added these people to aren't changed.",
      confirmLabel: "Delete team",
      danger: true,
    });
    if (confirmed && (await attempt(async () => (await teams.remove(), true), "Could not delete the team"))) {
      toast.show("Team deleted");
      onClosed();
    }
  }

  /** @param {Array<{ email: string, name: string }>} people */
  async function add(people) {
    await teams.addPeople(people);
    toast.show(`${pluralize(people.length, "person", "people")} added to the team`);
  }

  return (
    <View style={styles.detail}>
      <View style={styles.header}>
        <Text variant="title">{detail.team.name}</Text>
        {detail.team.description ? <Text muted>{detail.team.description}</Text> : null}
        <Text variant="small" muted>{`${pluralize(detail.members.length, "person", "people")} · only you can see this team`}</Text>
        <View style={styles.actions}>
          <Button variant="quiet" label="Edit team" onPress={edit} />
          <Button variant="quiet" textColor={colors.danger} label="Delete team" onPress={remove} />
        </View>
      </View>
      <Button variant="primary" label="Add people" onPress={() => setAdding(true)} />
      {detail.members.length ? (
        <>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={colors.placeholder} accessibilityLabel="Search people" autoCapitalize="none" style={styles.search} />
          {shown.map((member) => (
            <View key={member.email} style={styles.person}>
              <View style={styles.who}>
                <Text weight="semibold">{displayName(member)}</Text>
                {member.name ? (
                  <Text variant="small" muted>
                    {member.email}
                  </Text>
                ) : null}
              </View>
              <Button
                variant="quiet"
                textColor={colors.danger}
                label="Remove"
                accessibilityLabel={`Remove ${displayName(member)}`}
                onPress={() => attempt(() => teams.removePerson(member.email), "Could not remove the person")}
              />
            </View>
          ))}
          {!shown.length ? <Text muted>No one matches that search.</Text> : null}
        </>
      ) : (
        <Empty text="No one in this team yet. Add people by pasting their emails." />
      )}
      {adding ? <AddPeopleSheet title={`Add people to ${detail.team.name}`} excludeTeamId={detail.team.id} onSave={add} onClose={() => setAdding(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    gap: 12,
  },
  header: {
    gap: 6,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 20,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  who: {
    flex: 1,
    minWidth: 0,
  },
});
