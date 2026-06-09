/** @type {import('jest').Config} */
const config = {
  // Pure logic tests only — no React Native renderer needed.
  // Use the node environment to avoid the @react-native/jest-preset peer-dep
  // that jest-expo requires. The tested files (hypertrophy.ts, queries.ts)
  // have zero React Native imports, so node env works perfectly.
  testEnvironment: 'node',

  // Transform TypeScript with the presets already bundled in this project's
  // node_modules. We set configFile: false so Babel ignores the root
  // babel.config.js (which references babel-preset-expo, unavailable in devDeps)
  // and uses only this minimal inline config instead.
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: false,
        presets: [
          '@babel/preset-typescript',
        ],
        plugins: [
          '@babel/plugin-transform-modules-commonjs',
        ],
      },
    ],
  },

  // Mirror the tsconfig path alias @/* → src/*
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Only pick up files inside __tests__ directories or *.test.ts(x) files.
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // uuid ships ESM; transform it.
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
};

module.exports = config;
