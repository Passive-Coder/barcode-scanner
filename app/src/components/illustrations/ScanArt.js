import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../../lib/motion.js";
import { Text } from "../ui/Text.js";

const widths = [2, 2, 3, 3, 5];
const randomWidths = () => Array.from({ length: 30 }, () => widths[Math.floor(Math.random() * widths.length)]);
function randomCode() {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  const code = [...digits, (10 - sum % 10) % 10].join("");
  return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
}

/** The home card's barcode sweep and lock. */
export function ScanArt() {
  const reduced = useReducedMotion();
  const laser = useRef(new Animated.Value(0)).current;
  const lock = useRef(new Animated.Value(0)).current;
  const [bars, setBars] = useState(randomWidths);
  const [digits, setDigits] = useState(randomCode);

  useEffect(() => {
    if (reduced) return;
    const sequence = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(laser, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(lock, { toValue: 1, duration: 850, useNativeDriver: false }),
      ]),
      Animated.delay(1100),
      Animated.timing(lock, { toValue: 0, duration: 350, useNativeDriver: false }),
      Animated.timing(laser, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.delay(450),
    ]));
    sequence.start();
    const change = setInterval(() => {
      setBars(randomWidths());
      setDigits(randomCode());
    }, 3600);
    return () => {
      sequence.stop();
      clearInterval(change);
    };
  }, [laser, lock, reduced]);

  const cornerColor = lock.interpolate({ inputRange: [0, 1], outputRange: ["#c99a92", "#fff5e8"] });
  return (
    <View style={styles.art} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.finder}>
        {/** @type {const} */ (["topLeft", "topRight", "bottomLeft", "bottomRight"]).map((corner) => (
          <Animated.View key={corner} style={[styles.corner, styles[corner], { borderColor: cornerColor }]} />
        ))}
        <View style={styles.barcode}>
          <View style={styles.bars}>
            {bars.map((width, index) => <View key={index} style={[styles.bar, { width }]} />)}
            <Animated.View style={[styles.laser, { opacity: laser.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: laser.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }) }] }]} />
          </View>
          <Text variant="tiny" color="#e0bfb2" style={styles.digits}>{digits}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { height: 132, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, backgroundColor: "#4a0714" },
  finder: { width: 176, height: 102, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 14, height: 14, borderWidth: 0 },
  topLeft: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  topRight: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  barcode: { alignItems: "center", gap: 5 },
  bars: { flexDirection: "row", alignItems: "stretch", height: 58, gap: 2, paddingHorizontal: 4 },
  bar: { height: 58, borderRadius: 1, backgroundColor: "#f8ebd9" },
  laser: { position: "absolute", left: -10, right: -10, top: 0, height: 2, borderRadius: 2, backgroundColor: "#ffc2ae" },
  digits: { letterSpacing: 2 },
});
