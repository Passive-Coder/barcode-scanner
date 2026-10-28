import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";

/**
 * The event's name, description, the person's roles in it, and the actions their role allows.
 * @param {{ onClosed: () => void }} props
 */
export function EventHeader({ onClosed }) {
  useStore(events);
  const detail = events.detail;
  if (!detail) return null;
  const { event, me } = detail;
  const managed = detail.subteams.filter((subteam) => me.manages.includes(subteam.id));

  function editDetails() {
    dialogs.edit({
      title: "Edit event",
      submitLabel: "Save",
      fields: [
        { label: "Event name", value: event.name },
        { label: "Description (optional)", value: event.description, multiline: true },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the event a name.");
        await events.update({ name: name.trim(), description: description.trim() });
      },
    });
  }

  async function remove() {
    const confirmed = await dialogs.confirm({
      title: `Delete “${event.name}”?`,
      message: "Its people, sub-teams, document list, and alerts are deleted for everyone. Google Sheets and Docs stay in their owners' Drive, shared as they are now.",
      confirmLabel: "Delete event",
      danger: true,
    });
    if (confirmed && (await attempt(async () => (await events.remove(), true), "Could not delete the event"))) {
      toast.show("Event deleted");
      onClosed();
    }
  }

  async function leave() {
    const confirmed = await dialogs.confirm({
      title: `Leave “${event.name}”?`,
      message: "You'll stop seeing its documents and alerts. An organizer can add you again.",
      confirmLabel: "Leave event",
      danger: true,
    });
    if (confirmed && (await attempt(async () => (await events.removePerson(me.email), true), "Could not leave the event"))) {
      toast.show("You left the event");
      onClosed();
    }
  }

  return (
    <View style={styles.header}>
      <Text variant="title">{event.name}</Text>
      {event.description ? <Text muted>{event.description}</Text> : null}
      <View style={styles.roles}>
        <Pill label={me.isOwner ? "Owner" : me.role === "organizer" ? "Organizer" : "Member"} tone={me.role === "organizer" ? "accent" : "default"} />
        {managed.map((subteam) => (
          <Pill key={subteam.id} label={`Manager · ${subteam.name}`} />
        ))}
        <Text variant="small" muted>
          {pluralize(detail.members.length, "person", "people")}
        </Text>
      </View>
      <View style={styles.actions}>
        {me.canManage ? <Button variant="quiet" label="Edit details" onPress={editDetails} /> : null}
        {me.canDelete ? <Button variant="quiet" textColor={colors.danger} label="Delete event" onPress={remove} /> : <Button variant="quiet" textColor={colors.danger} label="Leave event" onPress={leave} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  roles: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 20,
  },
});
