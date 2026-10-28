import { StyleSheet, View } from "react-native";
import { timeAgo } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { alerts } from "../../stores/alerts.js";
import { Button } from "../ui/Button.js";
import { Empty } from "../ui/Empty.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";

/** Alerts sent to you in the last week, across your events. (Mirrors the website's AlertsDialog.) */
export function AlertList() {
  useStore(alerts);
  useStore(account);
  if (!account.ready) return <Empty text="Sign in to see alerts sent to you." />;
  if (!alerts.inbox.length) return <Empty text="No alerts in the last week." />;
  return (
    <View style={styles.list}>
      {alerts.inbox.map((alert) => (
        <View key={alert.id} style={[styles.alert, alert.urgency === "page" && styles.page, !alert.acknowledgedAt && styles.unread]}>
          <View style={styles.top}>
            <Text weight="semibold" style={styles.flex}>
              {alert.title}
            </Text>
            <Pill label={alert.urgency === "page" ? "Page" : "Notice"} tone={alert.urgency === "page" ? "danger" : "default"} />
          </View>
          {alert.body ? <Text>{alert.body}</Text> : null}
          <Text variant="small" muted>{`${alert.senderName || alert.senderEmail} · ${alert.eventName} · ${timeAgo(alert.createdAt)}`}</Text>
          {alert.acknowledgedAt ? (
            <Text variant="small" muted>
              Acknowledged
            </Text>
          ) : (
            <Button variant="quiet" label={alert.urgency === "page" ? "Acknowledge" : "Mark as seen"} onPress={() => alerts.acknowledge(alert.id)} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
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
  unread: {
    backgroundColor: colors.surfaceHover,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
