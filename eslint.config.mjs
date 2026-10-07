import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'src/generated/**', 'prototype/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**']),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Server code uses the redacting logger in src/server/log.ts, not console.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Scripts and tests print to the terminal on purpose. Listed last so it wins.
  { files: ['prisma/**', 'scripts/**', 'e2e/**', 'test/**', 'playwright.config.ts'], rules: { 'no-console': 'off' } },
]);
