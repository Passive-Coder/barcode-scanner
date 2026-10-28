import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "../../lib/theme.js";
import { Text } from "./Text.js";

/**
 * Tabs that switch what's shown below them. On narrow screens they wrap into a two-column grid
 * rather than scrolling sideways.
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: Array<{ value: string, label: string, count?: number }>,
 *   label: string,
 * }} props
 */
export function Tabs({ value, onChange, options, label }) {
  const [width, setWidth] = useState(0);
  const grid = width > 0 && width < 480 && options.length > 2;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.tabs, grid && styles.grid]}>
      {options.map((option, index) => {
        const active = option.value === value;
        const lastOdd = grid && index === options.length - 1 && options.length % 2 === 1;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.tab, grid && styles.cell, lastOdd && styles.full, active && styles.active, pressed && !active && styles.pressed]}
          >
            <Text weight="semibold" color={active ? colors.onAccent : colors.inkMuted} numberOfLines={1}>
              {option.label}
            </Text>
            {option.count ? (
              <View style={[styles.count, active && styles.countActive]}>
                <Text variant="tiny" color={active ? colors.onAccent : colors.ink}>
                  {String(option.count)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  grid: {
    justifyContent: "space-between",
  },
  tab: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.small,
  },
  cell: {
    width: "48.5%",
    paddingHorizontal: 6,
  },
  full: {
    width: "100%",
  },
  active: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(248, 235, 217, 0.13)",
    alignItems: "center",
  },
  countActive: {
    backgroundColor: "rgba(90, 13, 27, 0.15)",
  },
});
