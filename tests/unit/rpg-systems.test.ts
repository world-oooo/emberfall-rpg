import { describe, expect, it } from 'vitest';
import { createNewSave } from '../../src/game/core/session';
import { InventorySystem } from '../../src/game/systems/InventorySystem';
import { ProgressionSystem } from '../../src/game/systems/ProgressionSystem';
import { QuestSystem } from '../../src/game/systems/QuestSystem';
import { SaveSystem, type KeyValueStore } from '../../src/game/systems/SaveSystem';
import { rollLoot } from '../../src/game/data/loot';

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

describe('InventorySystem', () => {
  it('adds, removes, and equips items without losing save shape', () => {
    const save = createNewSave();
    const inventory = new InventorySystem(save);

    inventory.add('shuriken', 5);
    inventory.remove('rice_ball', 1);
    const equippedSlot = inventory.equip('katana');

    expect(inventory.quantityOf('shuriken')).toBe(5);
    expect(inventory.quantityOf('rice_ball')).toBe(1);
    expect(equippedSlot).toBe('weapon');
    expect(save.equipment.weapon).toBe('katana');
  });

  it('keeps currency in player coins instead of inventory stacks', () => {
    const save = createNewSave();
    const inventory = new InventorySystem(save);

    inventory.add('coin', 30);
    inventory.remove('coin', 7);

    expect(save.player.coins).toBe(23);
    expect(save.inventory.some((entry) => entry.itemId === 'coin')).toBe(false);
  });
});

describe('ProgressionSystem', () => {
  it('levels from XP thresholds and grants hearts every two levels', () => {
    const save = createNewSave();
    const result = new ProgressionSystem(save).addXp(55);

    expect(result.level).toBe(3);
    expect(result.levelsGained).toBe(2);
    expect(save.player.maxHp).toBe(8);
    expect(save.player.hp).toBe(8);
  });
});

describe('QuestSystem', () => {
  it('does not complete later objectives before their prerequisites', () => {
    const save = createNewSave();
    const quests = new QuestSystem(save);

    quests.start('quest_dimmed_shrine');
    quests.recordEnemyDefeated('slime');
    quests.recordAreaEntered('woods');

    expect(save.quests.quest_dimmed_shrine?.objectives.reach_woods).toBe(0);
    expect(save.quests.quest_dimmed_shrine?.objectives.defeat_slimes).toBe(0);

    quests.recordNpcSpoken('master_ryo');
    quests.recordAreaEntered('woods');
    quests.recordEnemyDefeated('slime');

    expect(save.quests.quest_dimmed_shrine?.objectives.reach_woods).toBe(1);
    expect(save.quests.quest_dimmed_shrine?.objectives.defeat_slimes).toBe(1);
  });

  it('completes and rewards the first quest exactly once', () => {
    const save = createNewSave();
    const quests = new QuestSystem(save);

    quests.start('quest_dimmed_shrine');
    quests.recordNpcSpoken('master_ryo');
    quests.recordAreaEntered('woods');
    quests.recordEnemyDefeated('slime');
    quests.recordEnemyDefeated('slime');
    quests.recordEnemyDefeated('slime');
    quests.recordEnemyDefeated('slime');
    quests.recordAreaEntered('shrine');

    expect(save.quests.quest_dimmed_shrine?.status).toBe('completed');
    expect(quests.claimReward('quest_dimmed_shrine')).not.toBeNull();
    expect(quests.claimReward('quest_dimmed_shrine')).toBeNull();
    expect(save.player.coins).toBe(30);
    expect(save.player.xp).toBe(40);
    expect(save.quests.quest_sleeping_guardian?.status).toBe('active');
  });
});

describe('loot tables', () => {
  it('rolls deterministic chest loot', () => {
    expect(rollLoot('chest_shrine_key', () => 0)).toEqual([{ itemId: 'shrine_key', quantity: 1 }]);
  });
});

describe('SaveSystem', () => {
  it('saves, loads, exports, imports, and deletes one slot', async () => {
    const store = new MemoryStore();
    const saves = new SaveSystem(store);
    const save = createNewSave();
    save.player.level = 2;
    save.player.mapId = 'woods';

    const saved = await saves.save(save);
    const loaded = await saves.load();
    const exported = await saves.export();
    await saves.delete();
    const empty = await saves.load();
    const imported = await saves.import(exported);

    expect(saved.savedAt).toBeGreaterThan(0);
    expect(loaded?.player.mapId).toBe('woods');
    expect(empty).toBeNull();
    expect(imported.player.level).toBe(2);
    expect(await saves.getMeta()).toMatchObject({ level: 2, mapId: 'woods' });
  });
}
);
