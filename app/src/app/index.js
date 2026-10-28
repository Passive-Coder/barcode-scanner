import { Redirect } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CouncilMark } from "../components/brand/CouncilMark.js";
import { GoogleGlyph } from "../components/brand/GoogleGlyph.js";
import { Ribbons } from "../components/brand/Ribbons.js";
import { EnterView } from "../components/ui/EnterView.js";
import { Text } from "../components/ui/Text.js";
import { config } from "../lib/config.js";
import { attempt } from "../lib/feedback.js";
import { useStore } from "../lib/store.js";
import { TOUCH, colors, radius } from "../lib/theme.js";
import { auth } from "../stores/auth.js";
import { workspace } from "../stores/workspace.js";

/** The welcome screen: what Linework does, and Continue with Google. Signed in, it goes home. */
export default function Welcome() {
  useStore(auth);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (auth.status === "connected" || auth.status === "expired") return <Redirect href="/home" />;
  const busy = auth.status === "connecting" || auth.status === "restoring";
  const problem = auth.problem;

  return (
    <View style={styles.screen}>
    <Ribbons height={Math.max(150, Math.min(280, height * 0.27))} />
    <Ribbons position="bottom" height={Math.max(150, Math.min(280, height * 0.27))} />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
      <EnterView y={14} duration={500} style={styles.stack}>
      <CouncilMark size={96} />
      <Text variant="title" accessibilityRole="header" style={styles.center}>
        stucovitv.in
      </Text>
      <Text variant="subheading" color={colors.inkMuted} style={styles.center}>
        Linework barcode scanner
      </Text>
      <Text style={[styles.center, styles.intro]}>Scan barcodes, inspect their fields, and record selected values in a Google Sheet you choose.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || Boolean(problem), busy }}
        disabled={busy || Boolean(problem)}
        onPress={() => attempt(() => workspace.connect(), "Google sign-in failed")}
        style={({ pressed }) => [styles.google, pressed && styles.pressed, (busy || problem) && styles.disabled]}
      >
        {busy ? <ActivityIndicator color="#1f1f1f" /> : <GoogleGlyph size={20} />}
        <Text weight="semibold" color="#1f1f1f">
          {auth.status === "restoring" ? "Signing you in…" : busy ? "Connecting…" : "Continue with Google"}
        </Text>
      </Pressable>
      {problem ? (
        <Text color={colors.danger} style={styles.center} accessibilityRole="alert">
          {problem}
        </Text>
      ) : (
        <Text variant="small" muted style={styles.center}>
          Sign-in asks for Google Sheets access so Linework can read and edit sheets you open here.
        </Text>
      )}
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => attempt(() => Linking.openURL(`${config.apiUrl}/privacy`), "Could not open the privacy policy")}>
        <Text variant="small" color={colors.link} style={styles.link}>
          Privacy policy
        </Text>
      </Pressable>
      </EnterView>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  stack: { width: "100%", maxWidth: 480, alignSelf: "center", alignItems: "center", gap: 14 },
  center: {
    textAlign: "center",
  },
  intro: {
    marginTop: 4,
    marginBottom: 12,
  },
  google: {
    minHeight: TOUCH + 6,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: "#ffffff",
  },
  pressed: {
    backgroundColor: "#f1ece6",
  },
  disabled: {
    opacity: 0.6,
  },
  link: {
    textDecorationLine: "underline",
    paddingVertical: 8,
  },
});
