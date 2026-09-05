import { expect, test } from './fixtures';

/**
 * Between the loading bar completing and the title menu being drawn there must be no blank pause: MainMenu's
 * own assets are loaded under the bar in PreloadScene. The two moments are stamped by the game itself
 * (bootPreloadComplete → bootMenuReady) and read through the DEV bridge, so the measurement does not depend
 * on catching a scene as "active" between frames.
 *
 * E2E_NET_KBPS=1500 throttles the network through CDP (Chromium) to show the real-world cost of downloading
 * after the bar has already read 100%. The dev server itself serves hundreds of unbundled modules, so `goto`
 * alone takes minutes under throttle; only the post-bar span is judged.
 */
test('the title menu is drawn as soon as the loading bar completes', async ({ page, browserName, errorWatcher }) => {
  void errorWatcher;
  test.setTimeout(300_000);
  const kbps = Number(process.env.E2E_NET_KBPS ?? '0');
  if (kbps > 0 && browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: (kbps * 1024) / 8,
      uploadThroughput: (kbps * 1024) / 8,
    });
  }
  await page.goto('/');
  const timeline = await page.evaluate(async () => {
    const deadline = performance.now() + 200_000;
    while (performance.now() < deadline) {
      const t = window.__GAME_TEST__?.getBootTimeline?.();
      if (t && t.menuReadyAt > 0) return t;
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  });
  expect(timeline).not.toBeNull();
  const gapMs = Math.round((timeline?.menuReadyAt ?? 0) - (timeline?.preloadCompleteAt ?? 0));
  console.log(`boot gap (${kbps > 0 ? `${kbps} kbps` : 'unthrottled'}): loading done -> menu drawn = ${gapMs} ms`);
  expect(timeline?.preloadCompleteAt ?? 0).toBeGreaterThan(0);
  expect(gapMs).toBeGreaterThanOrEqual(0);
  expect(gapMs).toBeLessThan(250);
});
