import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The measurement pass is slow and asserts nothing; run it on demand with `npm run test:perf`.
  testIgnore: ['**/performance.spec.ts', '**/screenshots.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Software WebGL makes a cold map load ~3 s, so the stock 30 s / 5 s budgets are too tight.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:5180',
    // Trace snapshots of a full-window WebGL canvas cost seconds per action under SwiftShader and were
    // themselves causing timeouts, so they are recorded only on the retry of a failing test.
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
