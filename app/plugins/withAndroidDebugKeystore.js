const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

// Use the local debug key whose SHA-1 is registered with the Android OAuth client.
// Expo's generated template has a different key, so a clean prebuild must replace it.
module.exports = (config) =>
  withDangerousMod(config, ["android", async (config) => {
    const source = process.env.LINEWORK_ANDROID_DEBUG_KEYSTORE || path.join(os.homedir(), ".android", "debug.keystore");
    if (fs.existsSync(source)) {
      const target = path.join(config.modRequest.platformProjectRoot, "app", "debug.keystore");
      if (path.resolve(source) !== path.resolve(target)) fs.copyFileSync(source, target);
    }
    return config;
  }]);
