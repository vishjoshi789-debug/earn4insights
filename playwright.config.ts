import { defineConfig, devices } from '@playwright/test'

// Target a remote deploy (e.g. Vercel) by setting PLAYWRIGHT_BASE_URL — avoids
// the slow local dev server. Falls back to the local dev server otherwise.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:9002'
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
  /* Local: start dev server manually (npm run dev) then `npx playwright test`.
     Remote: set PLAYWRIGHT_BASE_URL=<deploy-url> — no local server started. */
  webServer: isRemote
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:9002',
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
