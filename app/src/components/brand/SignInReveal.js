import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FILL, colors } from "../../lib/theme.js";
import { CouncilMark } from "./CouncilMark.js";

/** After sign-in the council mark turns, then flies to its place in the home header. */
/** @param {{ onDone: () => void }} props */
export function SignInReveal({ onDone }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const backdrop = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(-110)).current;
  const scale = useRef(new Animated.Value(0.35)).current;
  const flight = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 0, duration: 1500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      ]),
      Animated.timing(rotation, { toValue: 72, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(flight, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDoneRef.current();
    });
    return () => animation.stop();
  }, [backdrop, flight, rotation, scale]);

  const dx = width / 2 - 38;
  const dy = insets.top + 32 - height / 2;
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[FILL, { opacity: backdrop, backgroundColor: colors.bg }]} />
      <Animated.View style={[styles.mark, { transform: [
        { translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
        { translateY: flight.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
        { rotate: rotation.interpolate({ inputRange: [-110, 72], outputRange: ["-110deg", "72deg"] }) },
        { scale: Animated.multiply(scale, flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.19] })) },
      ] }]}>
        <CouncilMark size={160} color={colors.ink} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...FILL, zIndex: 800, elevation: 800, alignItems: "center", justifyContent: "center" },
  mark: { width: 160, height: 160 },
});
