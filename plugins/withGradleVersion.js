const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Pin the Gradle wrapper version on every prebuild.
 *
 * Expo SDK 56's bare template ships Gradle 9.3.1, but react-native 0.85.3 pins
 * AGP 8.12.0 + Kotlin 2.1.20, which reference `JvmVendorSpec.IBM_SEMERU` — a
 * field Gradle removed in 9.0. The result is a hard build failure:
 *   "Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field 'IBM_SEMERU'".
 * Gradle 8.13 is the version that AGP 8.12 / Kotlin 2.1.20 expect, so we pin it
 * here. `android/` is gitignored (managed/CNG workflow), so this plugin keeps the
 * fix reproducible across `expo prebuild` instead of relying on a manual edit.
 *
 * Revisit when a future Expo/RN aligns the template Gradle with AGP/Kotlin.
 */
const GRADLE_VERSION = '8.13';

module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      );
      const contents = fs.readFileSync(file, 'utf8');
      const next = contents.replace(
        /distributionUrl=.*/,
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`,
      );
      fs.writeFileSync(file, next);
      return cfg;
    },
  ]);
};
