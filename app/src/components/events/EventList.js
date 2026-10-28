import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { pluralize } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { dialogs } from "../../stores/dialogs.js";
import { events } from "../../stores/events.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";

/**
 * The events the signed-in person is part of, and a button to create one. Anyone can create an
 * event and becomes its owner.
 * @param {{ onOpen: (id: string) => void }} props
 */
export function EventList({ onOpen }) {
  useStore(events);
  useStore(account);
  const [loading, setLoading] = useState(false);
  // Loads once per session; a failed load shows a toast rather than retrying in a loop.
  const requested = useRef(false);

  useEffect(() => {
    if (!account.ready) {
      requested.current = false;
      return;
    }
    if (events.loaded || requested.current) return;
    requested.current = true;
    setLoading(true);
    attempt(() => events.load(), "Could not load events").finally(() => setLoading(false));
  }, [account.ready, events.loaded]);

  function create() {
    dialogs.edit({
      title: "Create an event",
      description: "You'll be its owner and first organizer. Add people, sub-teams, and documents next.",
      submitLabel: "Create event",
      fields: [
        { label: "Event name", placeholder: "Spring festival 2026" },
        { label: "Description (optional)", placeholder: "What it's for, when and where", multiline: true },
      ],
      onSubmit: async ([name, description]) => {
        if (!name.trim()) throw new Error("Give the event a name.");
        const detail = await events.create(name.trim(), description.trim());
        onOpen(detail.event.id);
      },
    });
  }

  return (
    <View style={styles.list}>
      <Button variant="primary" label="New event" onPress={create} />
      {events.list.length ? (
        events.list.map((event) => (
          <Pressable key={event.id} accessibilityRole="button" onPress={() => onOpen(event.id)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text variant="subheading">{event.name}</Text>
            <View style={styles.meta}>
              <Pill label={event.isOwner ? "Owner" : event.role === "organizer" ? "Organizer" : "Member"} tone={event.role === "organizer" ? "accent" : "default"} />
              {event.isManager ? <Pill label="Manager" /> : null}
              <Text variant="small" muted>
                {pluralize(event.memberCount, "person", "people")}
              </Text>
            </View>
            {event.role === "organizer" ? <Text variant="small" muted>{event.isOwner ? "Open to edit or delete this event" : "Open to edit this event"}</Text> : null}
          </Pressable>
        ))
      ) : (
        <Empty text={loading ? "Loading events…" : "No events yet. Create one, or ask an organizer to add your email to theirs."} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  item: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
});
