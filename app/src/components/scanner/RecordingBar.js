import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Switch, View } from "react-native";
import { useReducedMotion } from "../../lib/motion.js";
import { useStore } from "../../lib/store.js";
import { colors, radius } from "../../lib/theme.js";
import { auth } from "../../stores/auth.js";
import { changeLog } from "../../stores/changes.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "../ui/Button.js";
import { Text } from "../ui/Text.js";

/** Whether scans are being recorded, and if not, why, with the switch and settings to fix it. */
export function RecordingBar() {
  useStore(workspace);
  useStore(auth);
  useStore(changeLog);
  const { active, reason } = workspace.recording;
  const last = workspace.lastSave;
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const saving = workspace.pendingSaves > 0;
  useEffect(() => {
    if (!saving || reduced) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced, saving]);
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Animated.View style={[styles.dot, { backgroundColor: saving ? colors.accent : active ? colors.success : colors.warning, opacity: pulse }]} />
        <Text style={styles.flex}>{saving ? "Saving to Google Sheets…" : reason}</Text>
      </View>
      {last ? (
        <Text variant="small" color={last.ok ? colors.inkMuted : colors.danger}>
          {last.message}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Switch
          accessibilityLabel="Record scans automatically"
          value={workspace.autoSave}
          onValueChange={(value) => workspace.setAutoSave(value)}
          trackColor={{ true: colors.success, false: colors.lineStrong }}
          thumbColor={colors.inkStrong}
        />
        <Text style={styles.flex}>Record scans automatically</Text>
        <Button variant="quiet" label="Sheet settings" onPress={() => router.push("/sheets/settings")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceSunk,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
});
