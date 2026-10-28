const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds (the Google Play bundle) with Linework's upload key. Its location and
// passwords come from Gradle properties, normally ~/.gradle/gradle.properties, so they never
// enter the repository. Without them, release builds keep Expo's default debug signing, which
// Google Play rejects.
const RELEASE_SIGNING = `
        release {
            if (findProperty('LINEWORK_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('LINEWORK_UPLOAD_STORE_FILE'))
                storePassword findProperty('LINEWORK_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('LINEWORK_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('LINEWORK_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (!gradle.includes("LINEWORK_UPLOAD_STORE_FILE")) {
      gradle = gradle.replace(/(signingConfigs \{\n)/, `$1${RELEASE_SIGNING.slice(1)}\n`);
      gradle = gradle.replace(
        /(release \{\n(?:\s*\/\/.*\n)*\s*)signingConfig signingConfigs\.debug/,
        "$1signingConfig findProperty('LINEWORK_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
      );
      if (!gradle.includes("signingConfigs.release : signingConfigs.debug")) throw new Error("withAndroidReleaseSigning: build.gradle no longer has the expected release block.");
    }
    config.modResults.contents = gradle;
    return config;
  });
