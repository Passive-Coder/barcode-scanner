import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { displayName } from "../../lib/people.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Text } from "../ui/Text.js";
import { SubteamSheet } from "./SubteamSheet.js";

/** @typedef {import("../../stores/events.js").Subteam} Subteam */

/** The event's sub-teams and their managers; organizers create, edit, and delete them. */
export function EventSubteams() {
  useStore(events);
  const detail = events.detail;
  const [editing, setEditing] = useState(/** @type {{ subteam: Subteam | null } | null} */ (null));
  const names = useMemo(() => new Map((detail?.members ?? []).map((member) => [member.email, displayName(member)])), [detail]);
  if (!detail) return null;
  const { me } = detail;

  /** @param {Subteam} subteam */
  async function remove(subteam) {
    const confirmed = await dialogs.confirm({
      title: `Delete the “${subteam.name}” sub-team?`,
      message: "Its people stay in the event. Documents shared only with this sub-team lose that audience, and its managers can no longer page it.",
      confirmLabel: "Delete sub-team",
      danger: true,
    });
    if (confirmed) await attempt(() => events.deleteSubteam(subteam.id), "Could not delete the sub-team");
  }

  return (
    <View style={styles.section}>
      <Text muted>{`Sub-teams group people within the event. Their managers can page the sub-team's members${me.canManage ? ", and documents can be shared with a sub-team" : ""}.`}</Text>
      {me.canManage ? <Button variant="primary" label="New sub-team" onPress={() => setEditing({ subteam: null })} /> : null}
      {detail.subteams.length ? (
        detail.subteams.map((subteam) => {
          const managers = subteam.members.filter((member) => member.isManager);
          const mine = me.subteams.includes(subteam.id);
          const meta = [pluralize(subteam.members.length, "person", "people"), managers.length ? `managed by ${managers.map((manager) => names.get(manager.email) ?? manager.email).join(", ")}` : "", mine ? "you're in it" : ""].filter(Boolean).join(" · ");
          return (
            <View key={subteam.id} style={[styles.subteam, mine && styles.mine]}>
              <Text variant="subheading">{subteam.name}</Text>
              <Text variant="small" muted>
                {meta}
              </Text>
              {subteam.members.length ? (
                <View style={styles.chips}>
                  {subteam.members.map((member) => (
                    <View key={member.email} style={[styles.chip, member.isManager && styles.manager]}>
                      <Text variant="small" color={member.isManager ? colors.onAccent : colors.ink}>{`${names.get(member.email) ?? member.email}${member.isManager ? " · manager" : ""}`}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {me.canManage ? (
                <View style={styles.actions}>
                  <Button variant="quiet" label="Edit" accessibilityLabel={`Edit ${subteam.name}`} onPress={() => setEditing({ subteam })} />
                  <Button variant="quiet" textColor={colors.danger} label="Delete" accessibilityLabel={`Delete ${subteam.name}`} onPress={() => remove(subteam)} />
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <Empty text={me.canManage ? "No sub-teams yet. Create one from the event's people, or fill it from one of your teams." : "This event has no sub-teams yet."} />
      )}
      {editing ? <SubteamSheet subteam={editing.subteam} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  subteam: {
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  mine: {
    borderColor: colors.accent,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunk,
  },
  manager: {
    backgroundColor: colors.accent,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 18,
  },
});
