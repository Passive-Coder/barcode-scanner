import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../lib/theme.js";
import { Text } from "./Text.js";

/** What to show where a list has nothing in it yet, with what to do next. @param {{ text: string }} props */
export function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Text muted>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    borderRadius: radius.medium,
  },
});
