import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../lib/store.js";
import { useReducedMotion } from "../../lib/motion.js";
import { colors, radius } from "../../lib/theme.js";
import { toast } from "../../stores/toast.js";
import { Text } from "./Text.js";

/** The short message at the bottom of the screen. Tap to dismiss. */
export function Toast() {
  useStore(toast);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (toast.visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: toast.visible ? 1 : 0,
      duration: reduced ? 0 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !toast.visible) setMounted(false);
    });
    return () => animation.stop();
  }, [progress, reduced, toast.visible]);
  if (!mounted) return null;
  const error = toast.tone === "error";
  return (
    <View pointerEvents={toast.visible ? "box-none" : "none"} style={[styles.layer, { bottom: insets.bottom + 16 }]}>
      <Animated.View style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityHint="Dismisses the message"
          onPress={() => toast.dismiss()}
          style={[styles.toast, error && styles.error]}
        >
          <Text color={error ? colors.onDanger : colors.onAccent} weight="medium">
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  error: {
    backgroundColor: "#ffd9cf",
  },
});
