import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    // Set environment variables for tests
    env: {
      JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
      CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars-long',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
      NODE_ENV: 'test'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'tests', 'dist', '*.config.js']
    }
  }
});
