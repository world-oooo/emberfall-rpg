import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewSave } from '../../src/game/core/session';
import { SAVE_META_KEY, SAVE_SLOT_KEY, SaveSystem, type KeyValueStore } from '../../src/game/systems/SaveSystem';

class MemoryStore implements KeyValueStore {
  readonly values = new Map<IDBValidKey, unknown>();

  async get<T>(key: IDBValidKey): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async set(key: IDBValidKey, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async del(key: IDBValidKey): Promise<void> {
    this.values.delete(key);
  }
}

class MetaFailStore extends MemoryStore {
  override async set(key: IDBValidKey, value: unknown): Promise<void> {
    if (key === SAVE_META_KEY) throw new Error('metadata unavailable');
    await super.set(key, value);
  }
}

describe('SaveSystem validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses imports through the same structural and known-id validation used by load', () => {
    const save = createNewSave();
    save.player.mapId = 'woods';
    save.player.spawnId = 'from_village';
    save.inventory.push({ itemId: 'fox_charm', quantity: 1 });
    save.quests.quest_lost_charm = {
      status: 'rewarded',
      objectives: { find_charm: 1, return_mimi: 1 },
    };
    save.flags['shrine.braziers_lit'] = true;
    save.openedChests.push('chest_fox_charm');
    save.defeatedBosses.push('boss_racoon');

    const parsed = SaveSystem.parseImport(JSON.stringify(save));

    expect(parsed.player.mapId).toBe('woods');
    expect(parsed.inventory.some((entry) => entry.itemId === 'fox_charm')).toBe(true);
    expect(parsed.quests.quest_lost_charm?.status).toBe('rewarded');
    expect(parsed.defeatedBosses).toEqual(['boss_racoon']);
  });

  it('rejects malformed or impossible imports before they can overwrite the slot', () => {
    const valid = createNewSave();
    const cases = [
      '{',
      JSON.stringify({ ...valid, saveVersion: 999 }),
      JSON.stringify({ ...valid, player: { ...valid.player, mapId: 'moon' } }),
      JSON.stringify({ ...valid, player: { ...valid.player, hp: valid.player.maxHp + 1 } }),
      JSON.stringify({ ...valid, inventory: [{ itemId: 'missing_item', quantity: 1 }] }),
      JSON.stringify({ ...valid, inventory: [{ itemId: 'katana', quantity: 0 }] }),
      JSON.stringify({ ...valid, inventory: [{ itemId: 'rice_ball', quantity: 11 }] }),
      JSON.stringify({ ...valid, inventory: [...valid.inventory, { itemId: 'katana', quantity: 1 }] }),
      JSON.stringify({ ...valid, equipment: { weapon: 'rice_ball', accessory: null } }),
      JSON.stringify({ ...valid, inventory: valid.inventory.filter((entry) => entry.itemId !== 'katana') }),
      JSON.stringify({ ...valid, quests: { quest_lost_charm: { status: 'active', objectives: { find_charm: 2, return_mimi: 0 } } } }),
      JSON.stringify({ ...valid, defeatedBosses: ['slime'] }),
      JSON.stringify({ ...valid, flags: { broken: { nested: true } } }),
    ];

    for (const json of cases) expect(() => SaveSystem.parseImport(json)).toThrow();
  });

  it('does not report primary save failure when only metadata or persistence is unavailable', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn(async () => {
          throw new Error('permission rejected');
        }),
      },
    });
    const store = new MetaFailStore();
    const saves = new SaveSystem(store);
    const save = createNewSave();
    save.player.level = 3;

    await expect(saves.save(save)).resolves.toMatchObject({ player: { level: 3 } });
    await expect(saves.load()).resolves.toMatchObject({ player: { level: 3 } });
    expect(store.values.has(SAVE_SLOT_KEY)).toBe(true);
  });
});
