import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage, formatDateTime } from "../../lib/format.js";
import { colors } from "../../lib/theme.js";
import { events } from "../../stores/events.js";
import { Sheet } from "../ui/Sheet.js";
import { Text } from "../ui/Text.js";

/**
 * Who an alert reached and who has acknowledged it. For its sender and the organizers.
 * @param {{ alert: import("../../stores/alerts.js").Alert, onClose: () => void }} props
 */
export function AlertReceipts({ alert, onClose }) {
  const [recipients, setRecipients] = useState(/** @type {Array<{ email: string, name: string, acknowledgedAt: number | null }> | null} */ (null));
  const [error, setError] = useState("");
  const waiting = recipients?.filter((recipient) => !recipient.acknowledgedAt) ?? [];
  const seen = recipients?.filter((recipient) => recipient.acknowledgedAt) ?? [];

  useEffect(() => {
    let current = true;
    events
      .alertRecipients(alert.id)
      .then((list) => current && setRecipients(list))
      .catch((failure) => current && setError(errorMessage(failure)));
    return () => {
      current = false;
    };
  }, [alert.id]);

  return (
    <Sheet visible title={`“${alert.title}”`} onClose={onClose}>
      {error ? (
        <Text weight="semibold" color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : !recipients ? (
        <Text muted>Loading…</Text>
      ) : (
        <>
          <Text weight="semibold">{`${seen.length} of ${recipients.length} acknowledged`}</Text>
          {waiting.length ? (
            <View style={styles.group}>
              <Text variant="small" weight="semibold" color={colors.inkStrong} accessibilityRole="header">
                Not yet
              </Text>
              {waiting.map((person) => (
                <View key={person.email} style={styles.person}>
                  <Text style={styles.name}>{person.name || person.email}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {seen.length ? (
            <View style={styles.group}>
              <Text variant="small" weight="semibold" color={colors.inkStrong} accessibilityRole="header">
                Acknowledged
              </Text>
              {seen.map((person) => (
                <View key={person.email} style={styles.person}>
                  <Text style={styles.name}>{person.name || person.email}</Text>
                  <Text variant="small" muted>
                    {formatDateTime(new Date(/** @type {number} */ (person.acknowledgedAt)))}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 2,
  },
  person: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  name: {
    flexShrink: 1,
  },
});
