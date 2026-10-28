import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../lib/store.js";
import { CONTENT_WIDTH, FILL, TOUCH, colors, radius } from "../../lib/theme.js";
import { alerts } from "../../stores/alerts.js";
import { Text } from "./Text.js";

/**
 * A panel that slides up over the current screen, for dialogs and forms. Its content scrolls if
 * it's taller than the screen. Sheets step aside while a page fills the screen, and come back
 * (with what was typed in them) once it's acknowledged.
 * @param {{
 *   visible: boolean,
 *   title: string,
 *   onClose: () => void,
 *   children: import("react").ReactNode,
 *   dismissible?: boolean,
 *   footer?: import("react").ReactNode,
 * }} props
 */
export function Sheet({ visible, title, onClose, children, dismissible = true, footer }) {
  const insets = useSafeAreaInsets();
  const paging = useStore(alerts).pages.length > 0;
  const close = () => {
    if (dismissible) onClose();
  };
  return (
    <Modal visible={visible && !paging} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
          <View style={styles.top}>
            <Text variant="heading" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={!dismissible} onPress={close} hitSlop={8} style={styles.close}>
              <Text variant="heading" color={colors.ink}>
                ×
              </Text>
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...FILL,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: CONTENT_WIDTH,
    alignSelf: "center",
    paddingTop: 16,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    backgroundColor: colors.dialog,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
  },
  close: {
    width: TOUCH,
    height: TOUCH,
    marginTop: -8,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
