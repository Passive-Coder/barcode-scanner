import { Linking, Pressable, StyleSheet, View } from "react-native";
import { formatTime } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { session } from "../../stores/session.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Card } from "../ui/Card.js";
import { Empty } from "../ui/Empty.js";
import { Pill } from "../ui/Pill.js";
import { Text } from "../ui/Text.js";
import { EnterView } from "../ui/EnterView.js";

/** The latest (or chosen) scan: what it contains and every typed field found in it. */
export function ScanResult() {
  useStore(session);
  useStore(workspace);
  const scan = session.selected;
  if (!scan) return <Empty text="Scanned barcodes appear here, with every value found in them." />;
  const mapped = new Set(Object.values(workspace.mapping));
  const fields = [...scan.analysis.fields].sort((a, b) => Number(mapped.has(b.key)) - Number(mapped.has(a.key)));
  const link = scan.analysis.link;
  return (
    <EnterView key={scan.id} y={10} duration={350}>
      <Card>
      <View style={styles.top}>
        <Pill label={scan.analysis.contentType} tone="accent" />
        <Pill label={scan.format} />
        <Text variant="small" muted>
          {formatTime(scan.time)}
        </Text>
      </View>
      <Text variant="mono" selectable style={styles.raw}>
        {scan.text}
      </Text>
      {link ? <Button variant="quiet" label="Open link" accessibilityHint={link} onPress={() => Linking.openURL(link)} /> : null}
      <View style={styles.fields}>
        {fields.map((field, index) => (
          <EnterView key={`${scan.id}:${field.key}`} x={10} y={0} delay={Math.min(index, 12) * 35} duration={400} style={styles.field}>
            <View style={styles.label}>
              <Text variant="small" weight="semibold" color={mapped.has(field.key) ? colors.inkStrong : colors.inkMuted}>
                {field.label}
              </Text>
              {mapped.has(field.key) ? <Pill label="Mapped" tone="success" /> : null}
            </View>
            <Text selectable style={styles.value}>
              {field.value || "—"}
            </Text>
          </EnterView>
        ))}
      </View>
      </Card>
    </EnterView>
  );
}

/** Earlier scans from this session. Tap one to see it again. */
export function ScanHistory() {
  useStore(session);
  if (session.scans.length < 2) return null;
  return (
    <View style={styles.history}>
      <View style={styles.historyHead}>
        <Text variant="subheading">Earlier scans</Text>
        <Button variant="quiet" label="Clear" onPress={() => session.clear()} />
      </View>
      {session.scans.map((scan) => (
        <Pressable
          key={scan.id}
          accessibilityRole="button"
          accessibilityState={{ selected: scan.id === session.selected?.id }}
          onPress={() => session.select(scan.id)}
          style={({ pressed }) => [styles.item, scan.id === session.selected?.id && styles.current, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.flex}>
            {scan.text}
          </Text>
          <Text variant="small" muted>
            {formatTime(scan.time)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  raw: {
    padding: 10,
    borderRadius: radius.small,
    backgroundColor: colors.surfaceSunk,
  },
  fields: {
    gap: 0,
  },
  field: {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  label: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  value: {
    flexShrink: 1,
  },
  history: {
    gap: 6,
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.small,
  },
  current: {
    borderColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  flex: {
    flex: 1,
  },
});
