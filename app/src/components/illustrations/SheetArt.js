import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../../lib/motion.js";

/** Added, edited, deleted, edited: each tints the changed row the way Sheets highlights it. */
const actions = [
  { tint: "#cfe9d6", rows: 4 },
  { tint: "#f6dcae", rows: 4 },
  { tint: "#f3b3aa", rows: 3 },
  { tint: "#f6dcae", rows: 3 },
];

/** The home card's live spreadsheet illustration: rows add, update, and disappear. */
export function SheetArt() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(-1);
  const row = useRef(new Animated.Value(1)).current;
  const action = actions[Math.max(0, step) % actions.length];

  useEffect(() => {
    if (reduced) return;
    let current = 0;
    const cycle = () => {
      setStep(current++);
      row.setValue(0);
      Animated.timing(row, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    };
    const first = setTimeout(cycle, 600);
    const timer = setInterval(cycle, 2600);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      row.stopAnimation();
    };
  }, [reduced, row]);

  return (
    <View style={styles.art} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.page}>
        <View style={styles.fold} />
        <View style={styles.title} />
        {[0, 1, 2, 3].map((index) => {
          const shown = index < (step < 0 ? 3 : action.rows);
          if (!shown) return null;
          const active = index === (action.rows - 1) && step >= 0;
          return (
            <Animated.View key={index} style={[styles.gridRow, active && { backgroundColor: action.tint, opacity: row }]}>
              {[0, 1, 2].map((cell) => <View key={cell} style={[styles.cell, index === 0 && styles.headCell]}><View style={[styles.cellLine, { width: `${70 - cell * 10 + index * 3}%` }, index === 0 && styles.headLine]} /></View>)}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 132, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, backgroundColor: "#4a0714" },
  page: { width: 138, height: 108, paddingTop: 12, paddingHorizontal: 11, borderRadius: 6, backgroundColor: "#fff6e8", overflow: "hidden" },
  fold: { position: "absolute", top: 0, right: 0, width: 20, height: 20, backgroundColor: "#e3cdb1", borderBottomLeftRadius: 4 },
  title: { width: "46%", height: 5, marginBottom: 9, borderRadius: 3, backgroundColor: "#d8c1a6" },
  gridRow: { height: 10, marginBottom: 4, flexDirection: "row", gap: 4, borderRadius: 2 },
  cell: { flex: 1, paddingHorizontal: 2, justifyContent: "center", borderRadius: 2 },
  headCell: { backgroundColor: "#ecdccb" },
  cellLine: { height: 4, borderRadius: 2, backgroundColor: "#d6bfa6" },
  headLine: { backgroundColor: "#8e1f31" },
});
