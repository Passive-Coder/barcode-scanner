import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../../lib/motion.js";
import { attempt } from "../../lib/feedback.js";
import { TOUCH, colors, contentInset, radius } from "../../lib/theme.js";
import { workspace } from "../../stores/workspace.js";
import { Text } from "../ui/Text.js";
import { EnterView } from "../ui/EnterView.js";
import { BarcodeMark } from "./BarcodeMark.js";
import { CouncilMark } from "./CouncilMark.js";

/** Persistent header mark, morphing into a barcode on the scanner and sheet settings. */
/** @param {{ hidden?: boolean }} props */
export function HeaderLogo({ hidden = false }) {
  const pathname = usePathname();
  const barcode = pathname === "/sheets/scan" || pathname === "/sheets/settings";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const form = useRef(new Animated.Value(barcode ? 1 : 0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setMenuOpen(false);
    if (reduced) {
      form.setValue(barcode ? 1 : 0);
      sweep.setValue(0);
      return;
    }
    const morph = Animated.timing(form, {
      toValue: barcode ? 1 : 0,
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    morph.start(({ finished }) => {
      if (finished && barcode) {
        sweep.setValue(0);
        Animated.timing(sweep, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
      }
    });
    return () => {
      morph.stop();
      sweep.stopAnimation();
    };
  }, [barcode, form, reduced, sweep]);

  // On the right edge of the screen's top bar, which lines up with the content.
  const right = contentInset(width);
  return (
    <View pointerEvents={hidden ? "none" : "box-none"} style={[styles.wrapper, { top: insets.top + 10, right, opacity: hidden ? 0 : 1 }]}>
      <Animated.View style={[styles.tile, { borderRadius: form.interpolate({ inputRange: [0, 1], outputRange: [TOUCH / 2, radius.medium] }) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={barcode ? "Scanner menu" : "Account"} accessibilityState={barcode ? { expanded: menuOpen } : undefined} onPress={() => barcode ? setMenuOpen((value) => !value) : router.push("/account")} style={styles.button}>
          <Animated.View style={[styles.glyph, { opacity: form.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0, 0] }), transform: [{ rotate: form.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "72deg"] }) }, { scale: form.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }] }]}>
            <CouncilMark size={30} />
          </Animated.View>
          <Animated.View style={[styles.glyph, { opacity: form.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }), transform: [{ scaleY: form.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }] }]}>
            <BarcodeMark size={30} />
          </Animated.View>
          <Animated.View style={[styles.sweep, { opacity: sweep.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) }] }]} />
        </Pressable>
      </Animated.View>
      {menuOpen ? (
        <EnterView y={-6} duration={200} style={styles.menu}>
          <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); router.push(pathname === "/sheets/settings" ? "/sheets/scan" : "/sheets/settings"); }} style={styles.menuItem}>
            <Text weight="semibold">{pathname === "/sheets/settings" ? "Back to scanner" : "Sheet settings"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setMenuOpen(false); void attempt(() => workspace.signOut(), "Could not sign out"); }} style={styles.menuItem}>
            <Text weight="semibold" color={colors.danger}>Sign out</Text>
          </Pressable>
        </EnterView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", zIndex: 70, elevation: 70, alignItems: "flex-end" },
  tile: { width: TOUCH, height: TOUCH, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, overflow: "hidden" },
  button: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  glyph: { position: "absolute", alignItems: "center", justifyContent: "center" },
  sweep: { position: "absolute", width: 32, height: 2, borderRadius: 1, backgroundColor: "#ffb39e" },
  menu: { minWidth: 180, marginTop: 6, padding: 4, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.medium, backgroundColor: colors.dialog, elevation: 10 },
  menuItem: { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: 12 },
});
