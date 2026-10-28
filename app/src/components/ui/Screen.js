import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTENT_WIDTH, GUTTER, TOUCH, colors } from "../../lib/theme.js";
import { EnterView } from "./EnterView.js";
import { SessionBanner } from "./SessionBanner.js";
import { Text } from "./Text.js";

/** Goes back, or home if there's nowhere to go back to (for example after a notification). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/home");
}

/**
 * A full screen with a top bar (back button, a title that wraps to two lines, and an optional
 * action on the right) and content that scrolls. The width is capped for tablets. With
 * `scroll={false}`, the content fills the screen instead, for a list that scrolls itself.
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   back?: boolean,
 *   right?: import("react").ReactNode,
 *   children: import("react").ReactNode,
 *   scroll?: boolean,
 *   onRefresh?: () => void,
 *   refreshing?: boolean,
 *   banner?: boolean,
 * }} props
 */
export function Screen({ title, subtitle, back = true, right, children, scroll = true, onRefresh, refreshing = false, banner = true }) {
  const insets = useSafeAreaInsets();
  const content = (
    <EnterView style={[styles.content, !scroll && styles.flex]}>
      {banner ? <SessionBanner /> : null}
      {children}
    </EnterView>
  );
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.barRow}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={goBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
              <Text variant="subheading" color={colors.ink}>
                ←
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.titles}>
            <Text variant="subheading" accessibilityRole="header" numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="small" muted numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : <View style={styles.rightSpace} />}
        </View>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.fill]}>{content}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  // Lined up with the content below, so the back button and the corner logo sit on its edges.
  barRow: {
    width: "100%",
    maxWidth: CONTENT_WIDTH + GUTTER * 2,
    minHeight: 64,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: GUTTER,
    paddingVertical: 8,
  },
  back: {
    width: TOUCH,
    height: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: TOUCH / 2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 19,
    lineHeight: 23,
  },
  right: {
    flexShrink: 0,
  },
  rightSpace: { width: TOUCH },
  scroll: {
    paddingHorizontal: GUTTER,
    paddingTop: 16,
  },
  fill: {
    paddingHorizontal: GUTTER,
  },
  content: {
    width: "100%",
    maxWidth: CONTENT_WIDTH,
    alignSelf: "center",
    gap: 16,
  },
});
