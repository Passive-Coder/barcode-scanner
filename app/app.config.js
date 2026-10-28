// Expo configuration for the Linework app (iOS, Android, and a web build for development).
// Values come from EXPO_PUBLIC_ variables in .env, which are compiled into the app and so must be
// safe to publish: OAuth client IDs and the API address are; secrets never go here.

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
/** Google's iOS SDK returns to the app through the reversed iOS client ID. */
const IOS_URL_SCHEME = IOS_CLIENT_ID ? `com.googleusercontent.apps.${IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, "")}` : "";
const WINE = "#5c0a19";

module.exports = () => ({
  name: "Linework",
  slug: "linework",
  scheme: "linework",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: WINE,
  ios: {
    bundleIdentifier: "in.stucovitv.linework",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Pages from organizers break through Focus as time-sensitive notifications.
    entitlements: {
      "com.apple.developer.usernotifications.time-sensitive": true,
    },
  },
  android: {
    package: "in.stucovitv.linework",
    // Google Play needs a higher number for every upload.
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: WINE,
    },
    // Firebase config for push notifications on Android (an EAS file secret; see README).
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || undefined,
    permissions: ["android.permission.VIBRATE"],
    // Added by libraries for features Linework doesn't use (photos are picked with the system
    // picker, secure storage needs no fingerprint, and nothing draws over other apps).
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "./plugins/withAndroidDebugKeystore",
    "./plugins/withAndroidReleaseSigning",
    "expo-router",
    "expo-font",
    "expo-secure-store",
    ["expo-camera", { cameraPermission: "Linework uses the camera to scan barcodes.", recordAudioAndroid: false }],
    ["expo-image-picker", { photosPermission: "Linework reads barcodes from photos you choose.", microphonePermission: false }],
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#650a18", defaultChannel: "alerts" }],
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 140, backgroundColor: WINE }],
    // Without an iOS client ID, Google sign-in isn't configured (the app says so instead of crashing).
    ...(IOS_URL_SCHEME ? [["@react-native-google-signin/google-signin", { iosUrlScheme: IOS_URL_SCHEME }]] : []),
  ],
  extra: {
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined },
  },
});
