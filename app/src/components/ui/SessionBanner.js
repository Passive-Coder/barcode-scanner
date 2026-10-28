import { StyleSheet, View } from "react-native";
import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { account } from "../../stores/account.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "./Button.js";
import { Text } from "./Text.js";

/**
 * Says when Google or Linework's server needs attention, with the one action that fixes it.
 */
export function SessionBanner() {
  useStore(auth);
  useStore(account);
  const reconnect = () => attempt(() => workspace.connect(), "Google reconnect failed");

  if (auth.status === "expired" || (auth.status === "signed-out" && account.ready)) {
    return (
      <View style={styles.banner} accessibilityRole="alert">
        <Text style={styles.text}>{auth.status === "expired" ? "Your Google session expired. Reconnect to keep reading and recording to Sheets." : "Connect Google to use your spreadsheets."}</Text>
        <Button variant="primary" label={auth.status === "expired" ? "Reconnect" : "Connect Google"} busy={false} onPress={reconnect} />
      </View>
    );
  }
  if (account.status === "unavailable") {
    return (
      <View style={styles.banner} accessibilityRole="alert">
        <Text style={styles.text}>{`Linework's server can't be reached. ${account.problem} Scanning and Google Sheets still work, and changes are kept until it's back.`}</Text>
        <Button label="Try again" onPress={() => account.ensure()} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  banner: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceSunk,
  },
  text: {
    flexShrink: 1,
  },
});
