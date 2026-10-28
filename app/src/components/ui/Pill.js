import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../lib/theme.js";
import { Text } from "./Text.js";

/**
 * A small label, such as a role or a status. Long labels wrap inside it.
 * @param {{ label: string, tone?: "default" | "accent" | "danger" | "success" | "warning" }} props
 */
export function Pill({ label, tone = "default" }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text variant="tiny" color={palette.text}>
        {label}
      </Text>
    </View>
  );
}

const TONES = {
  default: { background: "rgba(248, 235, 217, 0.13)", text: colors.ink },
  accent: { background: colors.accent, text: colors.onAccent },
  danger: { background: "rgba(255, 180, 168, 0.22)", text: colors.danger },
  success: { background: "rgba(155, 216, 174, 0.2)", text: colors.success },
  warning: { background: "rgba(242, 196, 109, 0.22)", text: colors.warning },
};

const styles = StyleSheet.create({
  pill: {
    maxWidth: "100%",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
