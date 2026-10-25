import { defineConfig, devices } from '@playwright/test';

// Runs against the local stack: `pnpm db:reset` first (seeded data), then `pnpm test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
