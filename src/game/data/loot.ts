import { lootTableId, type LootTableId } from '../types/ids';
import type { InventoryEntry } from '../core/session';

export interface LootEntry {
  itemId: string;
  quantity: number;
  weight?: number;
}

export interface LootTableDefinition {
  id: LootTableId;
  rolls: number;
  entries: readonly LootEntry[];
}

const define = <T extends Record<string, Omit<LootTableDefinition, 'id'>>>(defs: T) =>
  Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { ...d, id: lootTableId(id) }])) as {
    [K in keyof T]: LootTableDefinition;
  };

export const LOOT_TABLES = define({
  chest_coins_small: { rolls: 1, entries: [{ itemId: 'coin', quantity: 20 }] },
  chest_coins_big: { rolls: 1, entries: [{ itemId: 'coin', quantity: 50 }] },
  chest_potion: { rolls: 1, entries: [{ itemId: 'life_potion', quantity: 1 }] },
  chest_shuriken: { rolls: 1, entries: [{ itemId: 'shuriken', quantity: 5 }] },
  chest_fox_charm: { rolls: 1, entries: [{ itemId: 'fox_charm', quantity: 1 }] },
  chest_shrine_key: { rolls: 1, entries: [{ itemId: 'shrine_key', quantity: 1 }] },
  chest_heavy_blade: { rolls: 1, entries: [{ itemId: 'heavy_blade', quantity: 1 }] },
  enemy_slime: { rolls: 1, entries: [{ itemId: 'coin', quantity: 1, weight: 4 }, { itemId: 'rice_ball', quantity: 1, weight: 1 }] },
  enemy_mushroom: { rolls: 1, entries: [{ itemId: 'coin', quantity: 2, weight: 3 }, { itemId: 'shuriken', quantity: 1, weight: 1 }] },
  enemy_bat: { rolls: 1, entries: [{ itemId: 'coin', quantity: 2 }] },
  enemy_skeleton: { rolls: 1, entries: [{ itemId: 'coin', quantity: 6, weight: 3 }, { itemId: 'life_potion', quantity: 1, weight: 1 }] },
  boss_guardian: { rolls: 1, entries: [{ itemId: 'ember', quantity: 1 }, { itemId: 'broken_mask', quantity: 1 }] },
});

export type KnownLootTableId = keyof typeof LOOT_TABLES;

export function getLootTable(id: string): LootTableDefinition {
  const table = (LOOT_TABLES as Record<string, LootTableDefinition>)[id];
  if (!table) throw new Error(`Unknown loot table: ${id}`);
  return table;
}

export function rollLoot(tableId: string, random: () => number = Math.random): InventoryEntry[] {
  const table = getLootTable(tableId);
  const drops: InventoryEntry[] = [];

  for (let roll = 0; roll < table.rolls; roll++) {
    const totalWeight = table.entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
    let cursor = random() * totalWeight;
    const fallback = table.entries[table.entries.length - 1];
    if (!fallback) continue;

    for (const entry of table.entries) {
      cursor -= entry.weight ?? 1;
      if (cursor <= 0) {
        drops.push({ itemId: entry.itemId, quantity: entry.quantity });
        break;
      }
    }
  }

  return drops;
}
