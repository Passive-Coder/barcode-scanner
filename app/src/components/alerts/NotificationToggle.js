import { Linking, Platform, StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { notifications } from "../../stores/notifications.js";
import { toast } from "../../stores/toast.js";
import { Button } from "../ui/Button.js";
import { Text } from "../ui/Text.js";

/** Turns alert notifications on or off for this phone. */
export function NotificationToggle() {
  useStore(notifications);
  useStore(account);

  async function enable() {
    if (await attempt(async () => (await notifications.enable(), true), "Could not turn on notifications")) toast.show("Alerts will now reach this phone");
  }

  async function disable() {
    await attempt(() => notifications.disable(), "Could not turn off notifications");
    toast.show("This phone won't get alert notifications");
  }

  // Whether this phone can turn notifications on at all.
  const available = notifications.supported && notifications.configured;
  const message = !notifications.supported
    ? Platform.OS === "web"
      ? "Notifications need the Linework app on a phone. Alerts still appear here while Linework is open."
      : "This is a simulator, which can't receive push notifications. Alerts still appear here while Linework is open."
    : !notifications.configured
      ? "This version of Linework can't receive notifications yet, so alerts appear only while it's open."
      : notifications.permission === "denied"
      ? "Notifications are turned off for Linework. Turn them on in your phone's Settings to get alerts while Linework is closed."
      : notifications.enabled
        ? "On. Pages and notices reach this phone even when Linework is closed."
        : "Off. Turn on to get pages and notices even when Linework is closed.";

  return (
    <View style={styles.toggle}>
      <View style={styles.text}>
        <Text weight="semibold">Notifications on this phone</Text>
        <Text variant="small" muted>
          {message}
        </Text>
        {available && notifications.problem && !notifications.enabled ? (
          <Text variant="small" color={colors.danger}>
            {notifications.problem}
          </Text>
        ) : null}
      </View>
      {!available ? null : notifications.permission === "denied" ? (
        <Button label="Open Settings" onPress={() => attempt(() => Linking.openSettings(), "Could not open Settings")} />
      ) : notifications.enabled ? (
        <Button label="Turn off" busy={notifications.busy} onPress={disable} />
      ) : (
        <Button variant="primary" label="Turn on" busy={notifications.busy} disabled={!account.ready} onPress={enable} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  text: {
    gap: 4,
  },
});
