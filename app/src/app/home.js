import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Ribbons } from "../components/brand/Ribbons.js";
import { ScanArt } from "../components/illustrations/ScanArt.js";
import { SheetArt } from "../components/illustrations/SheetArt.js";
import { EnterView } from "../components/ui/EnterView.js";
import { Screen } from "../components/ui/Screen.js";
import { Text } from "../components/ui/Text.js";
import { pluralize } from "../lib/format.js";
import { useStore } from "../lib/store.js";
import { colors, radius } from "../lib/theme.js";
import { alerts } from "../stores/alerts.js";
import { auth } from "../stores/auth.js";

/** Home: scanning and editing spreadsheets first, then events, teams, and alerts. */
export default function Home() {
  useStore(auth);
  useStore(alerts);
  return (
    <Screen title={`Hi ${auth.displayName}`} back={false}>
      <Text muted>What would you like to do?</Text>
      <EnterView delay={60} y={14}>
        <MenuCard title="Scan barcodes" subtitle="Use the camera or a photo, and record each scan to a sheet." art={<ScanArt />} onPress={() => router.push({ pathname: "/sheets", params: { intent: "scan" } })} />
      </EnterView>
      <EnterView delay={120} y={14}>
        <MenuCard title="Edit a spreadsheet" subtitle="View and change rows, columns, and tabs." art={<SheetArt />} onPress={() => router.push({ pathname: "/sheets", params: { intent: "edit" } })} />
      </EnterView>
      <EnterView delay={180} y={14} style={styles.more}>
        <MoreRow title="Events" subtitle="People, sub-teams, documents, and alerts" onPress={() => router.push("/events")} />
        <MoreRow title="Teams" subtitle="Your lists of people" onPress={() => router.push("/teams")} />
        <MoreRow title="Alerts" subtitle={alerts.unread ? pluralize(alerts.unread, "new alert") : "Pages and notices sent to you"} badge={alerts.unread} onPress={() => router.push("/alerts")} last />
      </EnterView>
      <View style={styles.ribbonSpace}>
        <Ribbons position="bottom" height={180} />
      </View>
    </Screen>
  );
}

/** @param {{ title: string, subtitle: string, art: import("react").ReactNode, onPress: () => void }} props */
function MenuCard({ title, subtitle, art, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.art}>{art}</View>
      <View style={styles.cardBody}>
        <View style={styles.cardText}>
          <Text variant="subheading" color={colors.inkStrong}>
            {title}
          </Text>
          <Text variant="small" color={colors.inkMuted}>
            {subtitle}
          </Text>
        </View>
        <Text variant="heading" color={colors.inkMuted}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

/** @param {{ title: string, subtitle: string, onPress: () => void, badge?: number, last?: boolean }} props */
function MoreRow({ title, subtitle, onPress, badge = 0, last = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text weight="semibold">{title}</Text>
        <Text variant="small" muted>
          {subtitle}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text variant="tiny" color={colors.onDanger}>
            {badge > 99 ? "99+" : String(badge)}
          </Text>
        </View>
      ) : null}
      <Text variant="heading" color={colors.inkMuted}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  card: {
    gap: 14,
    padding: 12,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardPressed: {
    backgroundColor: colors.surfaceHover,
  },
  art: {
    width: "100%",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  more: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  ribbonSpace: { height: 145, position: "relative", marginTop: 4 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
});
