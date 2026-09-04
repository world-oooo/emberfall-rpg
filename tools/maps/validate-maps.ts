/**
 * Development-time validation of generated maps against game data.
 * Fails the build on: duplicate spawn/chest ids, doors to missing maps/spawns, unknown enemy/npc/quest ids,
 * missing Collision layer, tile gids out of range, missing map properties.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MAPS_DIR } from './lib/builder.ts';

interface TiledProp { name: string; value: unknown }
interface TiledObj { type: string; name: string; properties?: TiledProp[] }
interface TiledLayer { type: string; name: string; data?: number[]; objects?: TiledObj[] }
interface TiledMap { properties?: TiledProp[]; layers: TiledLayer[]; tilesets: { firstgid: number; tilecount: number; name: string }[] }

const p = (o: { properties?: TiledProp[] }, n: string): unknown => o.properties?.find((q) => q.name === n)?.value;

// Known ids (kept in sync with src/game/data by the unit tests; duplicated here to stay Node-only)
const KNOWN_MAPS = ['village', 'woods', 'shrine'];
const KNOWN_ENEMIES = ['slime', 'mushroom', 'bat', 'skeleton', 'boss_racoon'];
const KNOWN_NPCS = ['elder_hana', 'master_ryo', 'merchant_botan', 'child_mimi', 'guard_goro', 'hermit_sen', 'villager_woman', 'villager_man'];
const KNOWN_QUESTS = ['quest_dimmed_shrine', 'quest_sleeping_guardian', 'quest_lost_charm'];
const KNOWN_LOOT = ['chest_coins_small', 'chest_potion', 'chest_shuriken', 'chest_fox_charm', 'chest_shrine_key', 'chest_coins_big', 'chest_heavy_blade'];

const errors: string[] = [];
const maps = new Map<string, TiledMap>();
for (const f of readdirSync(MAPS_DIR).filter((n) => n.endsWith('.json'))) {
  maps.set(f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(MAPS_DIR, f), 'utf8')) as TiledMap);
}

const spawnsByMap = new Map<string, Set<string>>();
for (const [id, m] of maps) {
  const spawns = new Set<string>();
  for (const l of m.layers) if (l.type === 'objectgroup' && l.name === 'Spawns') for (const o of l.objects ?? []) spawns.add(String(p(o, 'spawnId')));
  spawnsByMap.set(id, spawns);
}

for (const [id, m] of maps) {
  const tag = `[${id}]`;
  if (!KNOWN_MAPS.includes(id)) errors.push(`${tag} map id not in registry`);
  if (!p(m, 'mapId') || !p(m, 'displayName')) errors.push(`${tag} missing mapId/displayName properties`);
  if (!m.layers.some((l) => l.name === 'Collision')) errors.push(`${tag} missing Collision layer`);
  if (!m.layers.some((l) => l.name === 'Ground')) errors.push(`${tag} missing Ground layer`);
  const maxGid = Math.max(...m.tilesets.map((t) => t.firstgid + t.tilecount - 1));
  const seen = new Set<string>();
  for (const l of m.layers) {
    if (l.type === 'tilelayer') {
      for (const g of l.data ?? []) {
        const gid = g & 0x0fffffff;
        if (gid > maxGid) {
          errors.push(`${tag} layer ${l.name} has gid ${gid} > max ${maxGid}`);
          break;
        }
      }
      continue;
    }
    for (const o of l.objects ?? []) {
      switch (o.type) {
        case 'PlayerSpawn': {
          const s = String(p(o, 'spawnId'));
          if (seen.has(`spawn:${s}`)) errors.push(`${tag} duplicate spawnId ${s}`);
          seen.add(`spawn:${s}`);
          break;
        }
        case 'EnemySpawn': {
          const e = String(p(o, 'enemyId'));
          if (!KNOWN_ENEMIES.includes(e)) errors.push(`${tag} unknown enemyId ${e}`);
          const s = String(p(o, 'spawnId'));
          if (seen.has(`enemy:${s}`)) errors.push(`${tag} duplicate enemy spawnId ${s}`);
          seen.add(`enemy:${s}`);
          break;
        }
        case 'NPC': {
          const n = String(p(o, 'npcId'));
          if (!KNOWN_NPCS.includes(n)) errors.push(`${tag} unknown npcId ${n}`);
          break;
        }
        case 'Door': {
          const dm = String(p(o, 'destinationMap'));
          const ds = String(p(o, 'destinationSpawn'));
          if (!KNOWN_MAPS.includes(dm)) errors.push(`${tag} door to unknown map ${dm}`);
          else if (maps.has(dm) && !spawnsByMap.get(dm)?.has(ds)) errors.push(`${tag} door to ${dm} missing spawn ${ds}`);
          else if (!maps.has(dm)) console.warn(`${tag} door to ${dm} (not built yet)`);
          break;
        }
        case 'Chest': {
          const c = String(p(o, 'chestId'));
          if (seen.has(`chest:${c}`)) errors.push(`${tag} duplicate chestId ${c}`);
          seen.add(`chest:${c}`);
          const lt = String(p(o, 'lootTable'));
          if (!KNOWN_LOOT.includes(lt)) errors.push(`${tag} unknown lootTable ${lt}`);
          break;
        }
        case 'QuestTrigger': {
          const q = String(p(o, 'questId'));
          if (!KNOWN_QUESTS.includes(q)) errors.push(`${tag} unknown questId ${q}`);
          break;
        }
        default:
          break;
      }
    }
  }
}

if (errors.length) {
  console.error(`map validation failed (${errors.length}):`);
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}
console.log(`maps ok: ${[...maps.keys()].join(', ')}`);
