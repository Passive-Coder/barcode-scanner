import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../lib/theme.js";

/**
 * A raised panel for grouping related content.
 * @param {{ children: import("react").ReactNode, style?: import("react-native").StyleProp<import("react-native").ViewStyle>, tone?: "default" | "paper" | "danger" }} props
 */
export function Card({ children, style, tone = "default" }) {
  return <View style={[styles.card, tone === "paper" && styles.paper, tone === "danger" && styles.danger, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
  },
  paper: {
    borderColor: colors.paperLine,
    backgroundColor: colors.paper,
  },
  danger: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
});
