import { useEffect, useRef } from "react";
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, Vibration } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { timeAgo } from "../../lib/format.js";
import { useReducedMotion } from "../../lib/motion.js";
import { useStore } from "../../lib/store.js";
import { CONTENT_WIDTH, FILL, TOUCH, colors, radius } from "../../lib/theme.js";
import { alerts } from "../../stores/alerts.js";
import { Text } from "../ui/Text.js";

const BUZZ = [0, 400, 160, 400, 160, 400];

/**
 * A page fills the screen until it's acknowledged: the way an organizer or sub-team manager gets
 * everyone's attention at once. Several pages are shown one after another. It's a layer over the
 * whole app rather than a Modal, so it can't be blocked by a sheet that's open (sheets hide while
 * a page shows), and the back button doesn't dismiss it.
 */
export function AlertOverlay() {
  useStore(alerts);
  const insets = useSafeAreaInsets();
  const page = alerts.pages[0] ?? null;
  const total = alerts.pages.length;
  const announced = useRef("");
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!page || reduced) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [page?.id, pulse, reduced]);

  // Each new page buzzes once.
  useEffect(() => {
    if (!page || page.id === announced.current) return;
    announced.current = page.id;
    Vibration.vibrate(BUZZ);
  }, [page]);

  // A page must be acknowledged, so the Android back button does nothing while it shows.
  useEffect(() => {
    if (!page) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [page]);

  if (!page) return null;
  return (
    <Animated.View style={[styles.layer, { backgroundColor: pulse.interpolate({ inputRange: [0, 1], outputRange: ["#6e0b1d", "#8f1328"] }) }]} accessibilityViewIsModal importantForAccessibility="yes">
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}>
        <Text weight="semibold" color={colors.pageMuted}>{`${page.senderName || page.senderEmail} · ${page.eventName}${total > 1 ? ` · 1 of ${total}` : ""}`}</Text>
        <Text variant="title" color={colors.pageInk} accessibilityRole="header" style={styles.title}>
          {page.title}
        </Text>
        <Text color={colors.pageInk} style={styles.body}>
          {page.body || `Sent to ${page.audienceLabel}.`}
        </Text>
        <Text variant="small" color={colors.pageMuted}>
          {timeAgo(page.createdAt)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Acknowledge “${page.title}”`}
          onPress={() => alerts.acknowledge(page.id)}
          style={({ pressed }) => [styles.acknowledge, pressed && styles.pressed]}
        >
          <Text variant="subheading" color={colors.page}>
            Acknowledge
          </Text>
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...FILL,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: colors.page,
  },
  inner: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 14,
    width: "100%",
    maxWidth: CONTENT_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
  },
  body: {
    fontSize: 19,
    lineHeight: 27,
  },
  acknowledge: {
    minHeight: TOUCH + 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 24,
    borderRadius: radius.medium,
    backgroundColor: colors.pageInk,
  },
  pressed: {
    opacity: 0.85,
  },
});
