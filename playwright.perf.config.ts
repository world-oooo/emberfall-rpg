import base from './playwright.config';

/** Measurement-only run: `npm run test:perf`. Same server and browser flags, only the perf spec. */
export default { ...base, testIgnore: undefined, testMatch: ['**/performance.spec.ts', '**/boss-balance.spec.ts', '**/boot-gap.spec.ts'], retries: 0, timeout: 300_000 };
