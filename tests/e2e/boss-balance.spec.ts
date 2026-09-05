import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from './fixtures';
import { damageEnemy, interactAt, openGame, startNewGame, teleport } from './helpers/game';

/**
 * Boss balance measured with real player attacks. Runs with `npm run test:perf`; the default suite ignores it.
 *
 * The DEV `damageEnemy` helper proves the fight can end; it says nothing about how long it takes. This drives
 * a bot that only closes distance and swings, healed every 250 ms so death never ends the sample. It never
 * rolls, so the number is the floor of the fight's length: a player who dodges takes longer, one who cannot
 * read the boss dies. What the number checks is that the Mask Keeper cannot be trivialised by mashing.
 */

const round = (value: number): number => Math.round(value * 10) / 10;

const OUT = resolve(process.cwd(), 'artifacts', 'boss-balance.md');

async function expectMap(page: import('./fixtures').Page, mapId: string): Promise<void> {
  await page.waitForFunction((id) => window.__GAME_TEST__?.getCurrentMap() === id, mapId, { timeout: 45_000 });
}

test('boss fight with real attacks @perf', async ({ page, errorWatcher }) => {
  test.setTimeout(420_000);
  void errorWatcher;

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expectMap(page, 'woods');
  await teleport(page, 808, 80);
  await expectMap(page, 'shrine');
  for (const spawnId of ['shrine_skeleton_01', 'shrine_skeleton_02', 'shrine_skeleton_03', 'shrine_skeleton_04', 'shrine_bat_01', 'shrine_bat_02', 'shrine_bat_03']) {
    await damageEnemy(page, spawnId);
  }
  await interactAt(page, 120, 336);
  await interactAt(page, 248, 256);
  await teleport(page, 248, 200);
  await page.waitForTimeout(800);

  const result = await page.evaluate(async () => {
    const bridge = window.__GAME_TEST__;
    if (!bridge) return null;
    const fire = (code: string, keyCode: number, type: string): void => {
      window.dispatchEvent(new KeyboardEvent(type, { code, keyCode, which: keyCode, bubbles: true }));
    };
    const tap = (code: string, keyCode: number): void => {
      fire(code, keyCode, 'keydown');
      setTimeout(() => fire(code, keyCode, 'keyup'), 30);
    };
    const dirs: Record<string, [string, number]> = {
      up: ['ArrowUp', 38],
      down: ['ArrowDown', 40],
      left: ['ArrowLeft', 37],
      right: ['ArrowRight', 39],
    };
    type Enemy = { spawnId: string; hp: number; maxHp: number; x: number; y: number; dead: boolean };
    const findBoss = (): Enemy | undefined => (bridge.getEnemies() as Enemy[]).find((enemy) => enemy.spawnId === 'guardian_tanuki');

    const start = performance.now();
    let phase2At = -1;
    let lastAttack = 0;
    let lastHeal = 0;
    let hitsTaken = 0;
    let bossHits = 0;
    let lastBossHp = Number.POSITIVE_INFINITY;
    let lastHp = bridge.getPlayerState()?.hp ?? 0;
    let held: [string, number] | null = null;
    const release = (): void => {
      if (held) fire(held[0], held[1], 'keyup');
      held = null;
    };

    while (performance.now() - start < 300_000) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const now = performance.now();
      const boss = findBoss();
      const me = bridge.getPlayerState();
      if (!boss || boss.dead || !me) break;
      if (boss.hp < lastBossHp && Number.isFinite(lastBossHp)) bossHits += 1;
      lastBossHp = boss.hp;
      if (phase2At < 0 && boss.hp <= boss.maxHp / 2) phase2At = now - start;
      if (me.hp < lastHp) hitsTaken += 1;
      lastHp = me.hp;
      if (now - lastHeal > 250) {
        bridge.healPlayer();
        lastHeal = now;
        lastHp = bridge.getPlayerState()?.hp ?? lastHp;
      }
      // The boss body sits low in its 60 px frame; aim at it, not at the sprite centre.
      const dx = boss.x - me.x;
      const dy = boss.y + 12 - me.y;
      const distance = Math.hypot(dx, dy);
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? dirs.right : dirs.left) : dy > 0 ? dirs.down : dirs.up;
      if (!dir) break;
      if (distance > 34) {
        if (!held || held[0] !== dir[0]) {
          release();
          fire(dir[0], dir[1], 'keydown');
          held = dir;
        }
      } else {
        release();
        if (now - lastAttack > 140) {
          tap(dir[0], dir[1]);
          tap('KeyJ', 74);
          lastAttack = now;
        }
      }
    }
    release();
    const boss = findBoss();
    return {
      durationMs: Math.round(performance.now() - start),
      phase2At: Math.round(phase2At),
      bossHits,
      hitsTaken,
      killed: !boss || boss.dead,
      bossHp: boss?.hp ?? 0,
    };
  });
  if (!result) return;

  const lines = [
    '# Boss balance, measured',
    '',
    `Generated ${new Date().toISOString()} at 1920x1080, software WebGL, katana, no dodging, healed every 250 ms.`,
    '',
    `- Outcome: ${result.killed ? 'killed' : `not killed, ${result.bossHp} HP left`} after ${round(result.durationMs / 1000)} s`,
    `- Phase 2 reached at: ${result.phase2At >= 0 ? `${round(result.phase2At / 1000)} s` : 'never'}`,
    `- Player hits that landed: ${result.bossHits}`,
    `- Times the player was hit: ${result.hitsTaken}`,
    '',
    'A bot that never rolls sets the floor of the fight length. A player who reads the telegraphs and dodges',
    'spends more time out of range and takes longer; one who cannot read them dies. The design target for a',
    'real player is 90 to 150 seconds.',
    '',
  ];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`\n${lines.join('\n')}\nwrote ${OUT}`);
});
