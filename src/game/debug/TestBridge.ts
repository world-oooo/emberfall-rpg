import type Phaser from 'phaser';
import { hasSession, getSession } from '../core/session';
import type { WorldScene } from '../scenes/WorldScene';
import { SettingsStore, type Settings } from '../systems/SettingsStore';
import { Display, type DisplayLayout } from '../systems/DisplaySystem';

/**
 * DEV-only read-mostly API for Playwright: window.__GAME_TEST__.
 * Never shipped: main.ts only installs it when import.meta.env.DEV is true, so it is tree-shaken from production.
 */
export interface GameTestBridge {
  ready: boolean;
  rendererType: () => 'webgl' | 'canvas' | 'unknown';
  activeScenes: () => string[];
  getPlayerState: () => { x: number; y: number; facing: string; state: string | null; hp: number; maxHp: number } | null;
  getCurrentMap: () => string | null;
  getSave: () => unknown;
  getInventory: () => unknown;
  getQuests: () => unknown;
  getSettings: () => Settings;
  getDisplay: () => DisplayLayout;
  getEnemies: () => unknown[];
  getActiveInteraction: () => string | null;
  startScene: (key: string, data?: object) => void;
  teleport: (x: number, y: number) => void;
  damageEnemy: (spawnId: string, amount?: number) => boolean;
  damagePlayer: (amount?: number) => boolean;
  healPlayer: (amount?: number) => boolean;
  saveNow: () => Promise<void>;
}

export function installTestBridge(game: Phaser.Game): void {
  const world = (): WorldScene | null => {
    const s = game.scene.getScene('WorldScene') as WorldScene | null;
    return s && game.scene.isActive('WorldScene') ? s : null;
  };
  const bridge: GameTestBridge = {
    ready: false,
    rendererType: () => (game.renderer?.type === 2 ? 'webgl' : game.renderer?.type === 1 ? 'canvas' : 'unknown'),
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    getPlayerState: () => {
      const w = world();
      if (!w || !w.player) return null;
      const save = getSession().save;
      return { x: w.player.x, y: w.player.y, facing: w.player.facing, state: w.player.fsm.name, hp: save.player.hp, maxHp: save.player.maxHp };
    },
    getCurrentMap: () => world()?.mapDef.id ?? null,
    getSave: () => (hasSession() ? structuredClone(getSession().save) : null),
    getInventory: () => (hasSession() ? structuredClone(getSession().save.inventory) : null),
    getQuests: () => (hasSession() ? structuredClone(getSession().save.quests) : null),
    getSettings: () => structuredClone(SettingsStore.get()),
    getDisplay: () => ({ ...Display.layout }),
    getEnemies: () => world()?.combat?.enemies.map((enemy) => ({
      enemyId: enemy.def.id,
      spawnId: enemy.spawnId,
      hp: enemy.health.current,
      maxHp: enemy.health.max,
      x: enemy.x,
      y: enemy.y,
      dead: enemy.isDead,
    })) ?? [],
    getActiveInteraction: () => world()?.interactions?.getActive()?.id ?? null,
    startScene: (key, data) => game.scene.start(key, data),
    teleport: (x, y) => {
      const current = world();
      current?.player.setPosition(x, y);
      current?.player.body.velocity.set(0, 0);
    },
    damageEnemy: (spawnId, amount = 999) => {
      const current = world();
      const enemy = current?.getEnemyBySpawnId(spawnId);
      if (!current || !enemy) return false;
      return enemy.takeHit({
        amount,
        sourceX: current.player.x,
        sourceY: current.player.y,
        knockback: 0,
        hitstop: 0,
        faction: 'player',
      });
    },
    damagePlayer: (amount = 999) => {
      const current = world();
      if (!current) return false;
      return current.player.takeHit({
        amount,
        sourceX: current.player.x - 16,
        sourceY: current.player.y,
        knockback: 0,
        hitstop: 0,
        faction: 'enemy',
      });
    },
    healPlayer: (amount = 99) => {
      const current = world();
      if (!current) return false;
      current.player.health.heal(amount);
      return true;
    },
    saveNow: async () => {
      await world()?.autosave();
    },
  };
  (window as unknown as { __GAME_TEST__: GameTestBridge }).__GAME_TEST__ = bridge;
  game.events.once('ready', () => {
    bridge.ready = true;
  });
}
