import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['e2e/**', 'playwright.config.ts', 'playwright-report/**', 'test-results/**', 'coverage/**'],
    projects: [
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['server/tests/**/*.test.js'],
          exclude: ['node_modules', 'dist'],
          env: {
            JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
            CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars-long',
            REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
            PDF_SERVER_INTERNAL_TOKEN: 'test-pdf-server-internal-token-minimum-32-chars',
            NODE_ENV: 'test',
          },
        },
      },
      {
        test: {
          name: 'pdf-server',
          globals: true,
          environment: 'node',
          include: ['pdf-server/tests/**/*.test.js'],
          exclude: ['node_modules', 'dist'],
          env: {
            NODE_ENV: 'test',
            LOG_LEVEL: 'error',
            PDF_SERVER_INTERNAL_TOKEN: 'test-pdf-server-internal-token-minimum-32-chars',
          },
        },
      },
      'client/vitest.config.ts',
    ],
  },
});
