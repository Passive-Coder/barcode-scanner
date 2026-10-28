import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { timeAgo } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { alerts } from "../../stores/alerts.js";
import { events } from "../../stores/events.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";
import { AlertComposer } from "./AlertComposer.js";
import { AlertReceipts } from "./AlertReceipts.js";

/** @typedef {import("../../stores/alerts.js").Alert} Alert */

/** Sending alerts (organizers and managers) and the event's alert history. */
export function EventAlerts() {
  useStore(events);
  useStore(alerts);
  const detail = events.detail;
  const [receipts, setReceipts] = useState(/** @type {Alert | null} */ (null));
  const [refreshing, setRefreshing] = useState(false);
  if (!detail) return null;
  const { me } = detail;
  /** Acknowledgements for alerts sent to this person live in the inbox. */
  const myAcks = new Map(alerts.inbox.map((alert) => [alert.id, alert.acknowledgedAt]));

  async function refresh() {
    setRefreshing(true);
    await attempt(() => events.loadAlerts(), "Could not load alerts");
    setRefreshing(false);
  }

  return (
    <View style={styles.section}>
      {me.canSendAlerts ? <AlertComposer /> : <Text muted>Organizers and sub-team managers send alerts here. Alerts sent to you fill the screen or appear in your alerts list.</Text>}
      <View style={styles.head}>
        <Text variant="subheading" accessibilityRole="header" style={styles.flex}>
          {me.role === "organizer" ? "Alerts in this event" : "Your alerts in this event"}
        </Text>
        <Button variant="quiet" label="Refresh" busy={refreshing} onPress={refresh} />
      </View>
      {events.alerts.length ? (
        events.alerts.map((alert) => {
          const mine = alert.senderEmail === me.email;
          return (
            <View key={alert.id} style={[styles.alert, alert.urgency === "page" && styles.page]}>
              <View style={styles.top}>
                <Text weight="semibold" style={styles.flex}>
                  {alert.title}
                </Text>
                <Pill label={alert.urgency === "page" ? "Page" : "Notice"} tone={alert.urgency === "page" ? "danger" : "default"} />
              </View>
              {alert.body ? <Text>{alert.body}</Text> : null}
              <Text variant="small" muted>{`${mine ? "You" : alert.senderName || alert.senderEmail} → ${alert.audienceLabel} · ${timeAgo(alert.createdAt)}`}</Text>
              <View style={styles.foot}>
                {alert.recipientCount !== undefined && (mine || me.role === "organizer") ? (
                  <>
                    <Text variant="small" muted>{`${alert.acknowledgedCount ?? 0} of ${alert.recipientCount} acknowledged`}</Text>
                    <Button variant="quiet" label="Who's seen it" onPress={() => setReceipts(alert)} />
                  </>
                ) : null}
                {myAcks.has(alert.id) ? (
                  myAcks.get(alert.id) ? (
                    <Text variant="small" muted>
                      You acknowledged
                    </Text>
                  ) : (
                    <Button variant="quiet" label="Acknowledge" onPress={() => alerts.acknowledge(alert.id)} />
                  )
                ) : null}
              </View>
            </View>
          );
        })
      ) : (
        <Empty text="No alerts yet." />
      )}
      {receipts ? <AlertReceipts alert={receipts} onClose={() => setReceipts(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  alert: {
    gap: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  page: {
    borderLeftColor: colors.danger,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  foot: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 18,
  },
});
