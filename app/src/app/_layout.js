// Each weight is imported on its own so only these five fonts are bundled.
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { SchibstedGrotesk_400Regular } from "@expo-google-fonts/schibsted-grotesk/400Regular";
import { SchibstedGrotesk_500Medium } from "@expo-google-fonts/schibsted-grotesk/500Medium";
import { SchibstedGrotesk_600SemiBold } from "@expo-google-fonts/schibsted-grotesk/600SemiBold";
import { SchibstedGrotesk_700Bold } from "@expo-google-fonts/schibsted-grotesk/700Bold";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, router, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AlertOverlay } from "../components/alerts/AlertOverlay.js";
import { SignInReveal } from "../components/brand/SignInReveal.js";
import { HeaderLogo } from "../components/brand/HeaderLogo.js";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.js";
import { FormSheet } from "../components/ui/FormSheet.js";
import { Toast } from "../components/ui/Toast.js";
import { restoreSession, startSessionLifecycle } from "../lib/session-lifecycle.js";
import { useReducedMotion } from "../lib/motion.js";
import { useStore } from "../lib/store.js";
import { colors } from "../lib/theme.js";
import { alerts } from "../stores/alerts.js";
import { auth } from "../stores/auth.js";

/** The splash screen stays up at most this long while the app signs back in. */
const RESTORE_WAIT_MS = 4000;

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** The app's frame: fonts, the session's background work, screens, and what shows over them. */
export default function RootLayout() {
  useStore(auth);
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    IBMPlexMono_400Regular,
  });
  const [started, setStarted] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const previousStatus = useRef(auth.status);
  const reducedMotion = useReducedMotion();
  const ready = (fontsLoaded || Boolean(fontError)) && started;

  useEffect(() => {
    startSessionLifecycle();
    // Never keep the splash screen up for long, even if Google is slow to answer.
    const timer = setTimeout(() => setStarted(true), RESTORE_WAIT_MS);
    restoreSession()
      .catch((error) => console.warn("Could not restore the session.", error))
      .finally(() => {
        clearTimeout(timer);
        setStarted(true);
      });
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Signing out from anywhere returns to the welcome screen. An expired Google session stays
  // put and shows a reconnect banner instead, so work in progress isn't lost.
  useEffect(() => {
    if (ready && auth.status === "signed-out" && pathname !== "/") router.replace("/");
  }, [ready, auth.status, pathname]);

  useEffect(() => {
    if (ready && previousStatus.current === "connecting" && auth.status === "connected" && !reducedMotion) setRevealing(true);
    previousStatus.current = auth.status;
  }, [auth.status, ready, reducedMotion]);

  // Tapping an alert's notification opens the alerts list (a page also fills the screen).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type !== "alert") return;
      void alerts.poll();
      router.push("/alerts");
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {ready ? (
          <>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }} />
            {pathname !== "/" && auth.status !== "signed-out" ? <HeaderLogo hidden={revealing} /> : null}
            {revealing ? <SignInReveal onDone={() => setRevealing(false)} /> : null}
            <AlertOverlay />
            <Toast />
            <ConfirmDialog />
            <FormSheet />
          </>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
