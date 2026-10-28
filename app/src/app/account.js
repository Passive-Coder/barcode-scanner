import Constants from "expo-constants";
import { router } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import { NotificationToggle } from "../components/alerts/NotificationToggle.js";
import { CouncilMark } from "../components/brand/CouncilMark.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Screen } from "../components/ui/Screen.js";
import { Text } from "../components/ui/Text.js";
import { config } from "../lib/config.js";
import { attempt } from "../lib/feedback.js";
import { useStore } from "../lib/store.js";
import { colors } from "../lib/theme.js";
import { account } from "../stores/account.js";
import { auth } from "../stores/auth.js";
import { workspace } from "../stores/workspace.js";

/** Who's signed in, this phone's notifications, switching account, and signing out. */
export default function Account() {
  useStore(auth);
  useStore(account);

  /** Google's account chooser only appears once the current account is signed out. */
  async function switchAccount() {
    await attempt(() => workspace.signOut(), "Could not sign out");
    router.replace("/");
    await attempt(() => workspace.connect(), "Could not switch Google account");
  }

  async function signOut() {
    await attempt(() => workspace.signOut(), "Could not sign out");
    router.replace("/");
  }

  const session =
    account.status === "ready"
      ? "Connected to Linework"
      : account.status === "connecting"
        ? "Connecting to Linework…"
        : account.status === "unavailable"
          ? `Linework's server can't be reached. ${account.problem}`
          : "Not connected to Linework";

  return (
    <Screen title="Account">
      <Card>
        <View style={styles.identity}>
          <CouncilMark size={44} />
          <View style={styles.flex}>
            <Text variant="subheading">{auth.displayName === "there" ? "Signed in" : auth.displayName}</Text>
            {auth.email ? (
              <Text variant="small" muted>
                {auth.email}
              </Text>
            ) : null}
          </View>
        </View>
        <Text variant="small" color={account.status === "unavailable" ? colors.danger : colors.inkMuted}>
          {session}
        </Text>
        {account.status === "unavailable" ? <Button label="Try again" onPress={() => account.ensure()} /> : null}
      </Card>
      <NotificationToggle />
      <View style={styles.actions}>
        <Button label="Switch account" onPress={switchAccount} />
        <Button variant="primary" label="Sign out" onPress={signOut} />
      </View>
      <View style={styles.footer}>
        <Button variant="quiet" label="Privacy policy" style={styles.centred} onPress={() => attempt(() => Linking.openURL(`${config.apiUrl}/privacy`), "Could not open the privacy policy")} />
        <Text variant="small" muted>{`Linework ${Constants.expoConfig?.version ?? ""}`}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    gap: 10,
  },
  footer: {
    alignItems: "center",
    gap: 4,
  },
  centred: {
    alignSelf: "center",
  },
});
