import { devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Completion matrix: `npm run test:matrix`. Runs the whole game at three viewports in Chromium, WebKit and
 * Firefox, so "it finishes" is checked across the supported engines.
 */
export default {
  ...base,
  testIgnore: undefined,
  testMatch: '**/acceptance.spec.ts',
  // Nine scripted story runs back to back put the dev server under sustained load; one retry keeps a load
  // hiccup from reading as a game defect.
  retries: 1,
  timeout: 300_000,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
};
