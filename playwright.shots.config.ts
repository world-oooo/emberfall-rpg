import base from './playwright.config';

/** Screenshot baseline run: `npm run test:shots`. Writes artifacts/playthrough/*.png. */
export default { ...base, testIgnore: undefined, testMatch: '**/screenshots.spec.ts', retries: 0, timeout: 300_000 };
