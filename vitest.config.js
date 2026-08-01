import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: ['src/api/historical.js', 'src/api/marine.js'],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 52,
        statements: 55
      }
    }
  }
});
