import { defineConfig } from '@playwright/test';

/**
 * Tests de bout en bout (navigateur réel) : `npm run test:e2e`.
 * Sous Windows, le navigateur Edge installé est utilisé (aucun téléchargement) ;
 * ailleurs (CI), le Chromium de Playwright (`npx playwright install chromium`).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined),
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
