import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { dialogs } from "../../stores/dialogs.js";
import { teams } from "../../stores/teams.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Text } from "../ui/Text.js";

/**
 * Your teams: lists of people you work with, to add to events and sub-teams in one go.
 * @param {{ onOpen: (id: string) => void }} props
 */
export function TeamList({ onOpen }) {
  useStore(teams);
  useStore(account);
  const [loading, setLoading] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!account.ready) {
      requested.current = false;
      return;
    }
    if (teams.loaded || requested.current) return;
    requested.current = true;
    setLoading(true);
    attempt(() => teams.load(), "Could not load teams").finally(() => setLoading(false));
  }, [account.ready, teams.loaded]);

  function create() {
    dialogs.edit({
      title: "Create a team",
      description: "A list of people you work with. Only you can see it.",
      submitLabel: "Create team",
      fields: [
        { label: "Team name", placeholder: "Volunteers" },
        { label: "Description (optional)", placeholder: "Who they are" },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the team a name.");
        const team = await teams.create(name.trim(), description.trim());
        onOpen(team.id);
      },
    });
  }

  return (
    <View style={styles.list}>
      <Button variant="primary" label="New team" onPress={create} />
      {teams.list.length ? (
        teams.list.map((team) => (
          <Pressable key={team.id} accessibilityRole="button" onPress={() => onOpen(team.id)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text variant="subheading">{team.name}</Text>
            <Text variant="small" muted>{`${pluralize(team.member_count, "person", "people")}${team.description ? ` · ${team.description}` : ""}`}</Text>
            <Text variant="small" muted>Open to edit or delete this team</Text>
          </Pressable>
        ))
      ) : (
        <Empty text={loading ? "Loading teams…" : "No teams yet. A team is a list of names and emails you can add to any event at once."} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  item: {
    gap: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
});
