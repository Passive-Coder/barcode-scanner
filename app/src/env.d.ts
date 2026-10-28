// Expo inlines EXPO_PUBLIC_ variables from .env at build time.
declare const process: {
  env: {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
    readonly EXPO_PUBLIC_EAS_PROJECT_ID?: string;
    readonly NODE_ENV?: string;
  };
};
