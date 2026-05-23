import { defineConfig } from '@playwright/test'

// End-to-end tests launch the built Electron app via Playwright's _electron
// API (see https://www.electronjs.org/docs/latest/tutorial/automated-testing).
// Run `npm run build` first, or use `npm run test:e2e` which builds then tests.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list'
})
