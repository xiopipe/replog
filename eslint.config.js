// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build/tooling scripts (Node CommonJS, not app code) are out of scope for
    // the app lint pass — they use __dirname/require and run under Node, not RN.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'assets/icon-source/*'],
  },
]);
