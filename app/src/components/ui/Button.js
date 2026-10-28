import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { TOUCH, colors, radius } from "../../lib/theme.js";
import { Text } from "./Text.js";

/**
 * @typedef {"primary" | "secondary" | "quiet" | "danger"} ButtonVariant
 * @param {{
 *   label: string,
 *   onPress: () => unknown,
 *   variant?: ButtonVariant,
 *   busy?: boolean,
 *   disabled?: boolean,
 *   accessibilityLabel?: string,
 *   accessibilityHint?: string,
 *   style?: import("react-native").StyleProp<import("react-native").ViewStyle>,
 *   compact?: boolean,
 *   textColor?: string,
 * }} props textColor: for quiet buttons on light surfaces
 */
export function Button({ label, onPress, variant = "secondary", busy = false, disabled = false, accessibilityLabel, accessibilityHint, style, compact = false, textColor }) {
  const inactive = disabled || busy;
  const palette = PALETTES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={variant === "quiet" ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        variant === "quiet" ? styles.quiet : styles.filled,
        compact && variant !== "quiet" && styles.compact,
        { backgroundColor: pressed && variant !== "quiet" ? palette.pressed : palette.background, borderColor: palette.border },
        inactive && styles.inactive,
        pressed && variant === "quiet" && styles.quietPressed,
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={textColor ?? palette.text} /> : null}
      <Text weight="semibold" color={textColor ?? palette.text} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const PALETTES = {
  primary: { background: colors.accent, pressed: "#ead7bf", border: colors.accent, text: colors.onAccent },
  secondary: { background: colors.surface, pressed: colors.surfaceHover, border: colors.lineStrong, text: colors.inkStrong },
  danger: { background: colors.danger, pressed: "#ff9d8e", border: colors.danger, text: colors.onDanger },
  quiet: { background: "transparent", pressed: "transparent", border: "transparent", text: colors.link },
};

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.small,
    borderWidth: 1,
  },
  filled: {
    paddingHorizontal: 16,
  },
  compact: {
    minHeight: 38,
    paddingHorizontal: 12,
  },
  quiet: {
    paddingHorizontal: 2,
    alignSelf: "flex-start",
  },
  quietPressed: {
    opacity: 0.6,
  },
  inactive: {
    opacity: 0.45,
  },
  label: {
    textAlign: "center",
    flexShrink: 1,
  },
});
