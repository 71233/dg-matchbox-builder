import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000/';
const testsProductionBuild = baseURL.includes(':4173');

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: testsProductionBuild
      ? 'npm run preview -- --host localhost --port 4173'
      : 'npm run dev -- --host localhost --port 3000',
    url: baseURL,
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
