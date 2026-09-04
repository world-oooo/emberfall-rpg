import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from './fixtures';
import { openGame, startNewGame } from './helpers/game';

/**
 * Measurement pass, not a pass/fail suite. Run it with `npm run test:perf`; the default E2E run ignores it.
 * Everything is sampled inside the page, because a CDP round trip costs more than the frames being measured.
 *
 * Numbers land in artifacts/measurements.md and feed docs/POLISH_AUDIT.md.
 */

const VIEWPORTS: Array<[number, number]> = [
  [1280, 720],
  [1366, 768],
  [1440, 800],
  [1440, 900],
  [1536, 864],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
];

interface FrameStats {
  avg: number;
  p95: number;
  p99: number;
  max: number;
  over33: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

const report: string[] = [];

test.afterAll(() => {
  if (!report.length) return;
  const out = resolve(process.cwd(), 'artifacts', 'measurements.md');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `# Emberfall measurements\n\nGenerated ${new Date().toISOString()}\n\n${report.join('\n')}\n`, 'utf8');
  console.log(`\n${report.join('\n')}\n\nwrote ${out}`);
});

test('viewport matrix @perf', async ({ page, errorWatcher }) => {
  test.setTimeout(180_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);

  const rows: string[] = ['## Viewport matrix', '', '| Viewport | Canvas CSS | Zoom | World shown | Window used |', '|---|---|---|---|---|'];
  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    const measured = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { cssWidth: Math.round(rect.width), cssHeight: Math.round(rect.height) };
    });
    const display = await page.evaluate(() => window.__GAME_TEST__?.getDisplay() ?? null);
    if (!measured) continue;
    const used = ((measured.cssWidth * measured.cssHeight) / (width * height)) * 100;
    const zoom = display ? `${display.zoom}x` : '?';
    const world = display ? `${display.width}x${display.height}` : '?';
    rows.push(`| ${width}x${height} | ${measured.cssWidth}x${measured.cssHeight} | ${zoom} | ${world} | ${round(used)}% |`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  report.push(...rows, '');
});

test('frame times and transitions @perf', async ({ page, errorWatcher }) => {
  test.setTimeout(240_000);
  void errorWatcher;

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openGame(page);

  const sample = async (frames: number): Promise<FrameStats> =>
    page.evaluate(async (count) => {
      const deltas: number[] = [];
      let last = performance.now();
      for (let i = 0; i < count; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        const now = performance.now();
        deltas.push(now - last);
        last = now;
      }
      deltas.sort((a, b) => a - b);
      const at = (q: number): number => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))] ?? 0;
      return {
        avg: deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
        p95: at(0.95),
        p99: at(0.99),
        max: deltas[deltas.length - 1] ?? 0,
        over33: deltas.filter((value) => value > 33).length,
      };
    }, frames);

  const rows: string[] = ['## Frame time (1920x1080, software WebGL)', '', '| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |', '|---|---|---|---|---|---|'];
  const record = async (label: string, frames = 240): Promise<void> => {
    const stats = await sample(frames);
    rows.push(`| ${label} | ${round(stats.avg)} | ${round(stats.p95)} | ${round(stats.p99)} | ${round(stats.max)} | ${stats.over33} |`);
  };

  await record('Main menu');
  await startNewGame(page);
  await record('Village idle');

  await page.keyboard.down('KeyD');
  await record('Village walking');
  await page.keyboard.up('KeyD');

  const transitions: string[] = ['## Map transitions', '', '| Transition | Cold ms | Warm ms |', '|---|---|---|'];
  const move = async (x: number, y: number): Promise<number> =>
    page.evaluate(
      async ({ targetX, targetY }) => {
        const bridge = window.__GAME_TEST__;
        if (!bridge) return -1;
        const from = bridge.getCurrentMap();
        const start = performance.now();
        bridge.teleport(targetX, targetY);
        for (let i = 0; i < 1800; i += 1) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
          const now = bridge.getCurrentMap();
          if (now && now !== from) return Math.round(performance.now() - start);
        }
        return -1;
      },
      { targetX: x, targetY: y },
    );

  const coldWoods = await move(328, 472);
  await page.waitForTimeout(1200);
  await record('Woods idle');
  const coldVillage = await move(488, 8);
  await page.waitForTimeout(1200);
  const warmWoods = await move(328, 472);
  await page.waitForTimeout(1200);
  const coldShrine = await move(808, 80);
  await page.waitForTimeout(1200);
  await record('Shrine idle');
  const warmWoods2 = await move(240, 632);
  transitions.push(`| village to woods | ${coldWoods} | ${warmWoods} |`);
  transitions.push(`| woods to village | ${coldVillage} | - |`);
  transitions.push(`| woods to shrine | ${coldShrine} | - |`);
  transitions.push(`| shrine to woods | - | ${warmWoods2} |`);

  // Input latency: how long from a keydown until the player actually starts moving.
  await page.waitForFunction(() => window.__GAME_TEST__?.getCurrentMap() === 'woods', null, { timeout: 30_000 });
  await page.waitForTimeout(600);
  const latency = await page.evaluate(async () => {
    const bridge = window.__GAME_TEST__;
    if (!bridge) return -1;
    const before = bridge.getPlayerState()?.x ?? 0;
    const start = performance.now();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', keyCode: 68, which: 68, bubbles: true }));
    let elapsed = -1;
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      if ((bridge.getPlayerState()?.x ?? 0) !== before) {
        elapsed = Math.round(performance.now() - start);
        break;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', keyCode: 68, which: 68, bubbles: true }));
    return elapsed;
  });

  const heap = await page.evaluate(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? Math.round(memory.usedJSHeapSize / 1048576) : -1;
  });

  report.push(...rows, '', ...transitions, '', `## Other`, '', `- Input latency (keydown to first movement): ${latency} ms`, `- JS heap: ${heap} MB`, '');
});
