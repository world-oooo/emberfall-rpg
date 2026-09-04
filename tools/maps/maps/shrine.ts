/**
 * Hollow Shrine — 30x40. Interior dungeon: entry hall, key side room, sealed door, boss arena, ember pedestal.
 */
import { SceneMap } from '../lib/scene.ts';
import { rect } from '../lib/builder.ts';

const FLOOR = 'TilesetInteriorFloor';
const WALL = 'TilesetWallSimple';
const INTERIOR = 'TilesetInterior';
const DUNGEON = 'TilesetDungeon';
const ELEMENT = 'TilesetElement';

function fillLocal(m: SceneMap, layer: 'ground' | 'below' | 'above', tileset: string, local: number, x: number, y: number, w: number, h: number): void {
  const target = m[layer];
  const gid = m.b.gid(tileset, local);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) target.set(i, j, gid);
}

function stamp(m: SceneMap, layer: 'groundDetail' | 'below' | 'above', tileset: string, x: number, y: number, block: number[][]): void {
  m.b.stamp(m[layer], tileset, x, y, block);
}

function wall(m: SceneMap, x: number, y: number, w: number, h: number): void {
  fillLocal(m, 'below', WALL, 25, x, y, w, h);
  m.solid(x, y, w, h);
}

function pillar(m: SceneMap, x: number, y: number): void {
  stamp(m, 'below', WALL, x, y, [
    [25, 26],
    [32, 33],
  ]);
  m.solid(x, y, 2, 2);
}

function statue(m: SceneMap, x: number, y: number, broken = false): void {
  stamp(m, 'below', DUNGEON, x, y, [[broken ? 22 : 20]]);
  m.solid(x, y);
}

function brazier(m: SceneMap, x: number, y: number): void {
  stamp(m, 'below', DUNGEON, x, y, [[14]]);
  m.solid(x, y);
}

function trim(m: SceneMap, x: number, y: number, w: number, h: number): void {
  for (let i = x; i < x + w; i++) {
    m.below.set(i, y, m.b.gid(INTERIOR, 90));
    m.below.set(i, y + h - 1, m.b.gid(INTERIOR, 102));
  }
  for (let j = y; j < y + h; j++) {
    m.below.set(x, j, m.b.gid(INTERIOR, 96));
    m.below.set(x + w - 1, j, m.b.gid(INTERIOR, 98));
  }
}

function crackScatter(m: SceneMap, rooms: boolean[][], count: number): void {
  const cracks = [210, 211, 226, 227, 228, 229];
  for (let i = 0; i < count; i++) {
    const x = 2 + Math.floor(m.b.random() * (m.width - 4));
    const y = 2 + Math.floor(m.b.random() * (m.height - 4));
    if (!rooms[y]?.[x] || m.isSolid(x, y) || m.groundDetail.get(x, y) !== 0 || m.below.get(x, y) !== 0) continue;
    m.groundDetail.set(x, y, m.b.gid(ELEMENT, m.b.pick(cracks)));
  }
}

export function buildShrine(): string {
  const m = new SceneMap(
    { id: 'shrine', displayName: 'Hollow Shrine', music: 'shrine', tint: '#6f7f72', width: 30, height: 40, seed: 19 },
    ['TilesetInteriorFloor', 'TilesetWallSimple', 'TilesetInterior', 'TilesetDungeon', 'TilesetWater', 'TilesetElement'],
  );
  const W = m.width;
  const H = m.height;

  fillLocal(m, 'ground', FLOOR, 124, 0, 0, W, H);

  const rooms = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  rect(rooms, 10, 31, 10, 8); // entrance
  rect(rooms, 8, 23, 14, 10); // lower hall
  rect(rooms, 3, 18, 9, 8); // key room
  rect(rooms, 18, 17, 8, 8); // bat gallery
  rect(rooms, 11, 10, 8, 12); // sealed stair
  rect(rooms, 13, 21, 4, 3); // narrow connector into the sealed stair
  rect(rooms, 5, 1, 20, 12); // boss arena
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!rooms[y]?.[x]) m.solid(x, y);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!rooms[y]?.[x]) continue;
      const variant = (x + y) % 11 === 0 ? 125 : (x * 3 + y) % 17 === 0 ? 126 : 124;
      m.ground.set(x, y, m.b.gid(FLOOR, variant));
    }
  }

  trim(m, 10, 31, 10, 8);
  trim(m, 8, 23, 14, 10);
  trim(m, 3, 18, 9, 8);
  trim(m, 18, 17, 8, 8);
  trim(m, 11, 10, 8, 12);
  trim(m, 5, 1, 20, 12);

  // Perimeter stone mass; leave the bottom doorway open.
  wall(m, 0, 0, W, 1);
  wall(m, 0, H - 1, 12, 1);
  wall(m, 18, H - 1, 12, 1);
  wall(m, 0, 0, 1, H);
  wall(m, W - 1, 0, 1, H);

  // Lower shrine pressure: narrow entry, broken statues, first skeletons.
  wall(m, 8, 30, 3, 1);
  wall(m, 19, 30, 3, 1);
  wall(m, 7, 23, 1, 10);
  wall(m, 22, 23, 1, 10);
  statue(m, 9, 27, true);
  statue(m, 20, 27, true);
  brazier(m, 12, 29);
  brazier(m, 17, 29);
  m.enemy('skeleton', 12, 26, 'shrine_skeleton_01');
  m.enemy('skeleton', 17, 24, 'shrine_skeleton_02');

  // Key side room: guarded but optional-looking, with the key chest at the far wall.
  pillar(m, 4, 19);
  pillar(m, 9, 19);
  statue(m, 5, 24, true);
  statue(m, 10, 24);
  m.chest('chest_shrine_key', 7, 20, 'chest_shrine_key');
  m.enemy('bat', 6, 23, 'shrine_bat_01');
  m.enemy('skeleton', 9, 23, 'shrine_skeleton_03');

  // Bat gallery and reward room.
  pillar(m, 19, 18);
  pillar(m, 23, 18);
  m.chest('chest_shrine_supplies', 22, 22, 'chest_potion');
  m.enemy('bat', 20, 20, 'shrine_bat_02');
  m.enemy('bat', 24, 22, 'shrine_bat_03');

  // Sealed ascent to the guardian.
  wall(m, 10, 21, 3, 1);
  wall(m, 17, 21, 3, 1);
  wall(m, 10, 13, 3, 1);
  wall(m, 17, 13, 3, 1);
  pillar(m, 12, 16);
  pillar(m, 16, 16);
  brazier(m, 13, 12);
  brazier(m, 16, 12);
  m.door(13, 13, 4, 1, 'shrine', 'boss_gate', {
    locked: true,
    requiredItem: 'shrine_key',
    lockedMessage: 'A cold seal bars the way. The shrine key should fit here.',
  });
  m.sign('sign_shrine_seal', 15, 14, 'The guardian sleeps beyond the sealed stair.');
  m.enemy('skeleton', 14, 18, 'shrine_skeleton_04');

  // Guardian arena: 14x10 tiles, pillars as cover, ember pedestal at the back.
  pillar(m, 7, 4);
  pillar(m, 21, 4);
  pillar(m, 7, 9);
  pillar(m, 21, 9);
  statue(m, 10, 2);
  statue(m, 19, 2, true);
  brazier(m, 11, 11);
  brazier(m, 18, 11);
  m.enemy('boss_racoon', 15, 7, 'guardian_tanuki', 'never', { boss: true, questId: 'quest_sleeping_guardian' });
  m.interactable('Shrine', 'ember_pedestal', 15, 3, { text: 'The stolen ember waits here, warm enough to carry home.' });
  m.solid(15, 3);
  m.trigger('quest_sleeping_guardian', 'enter_boss_arena', 5, 1, 20, 12);
  m.cameraBounds('boss_arena', 5, 1, 20, 12);

  crackScatter(m, rooms, 95);

  // Subtle water/void-like damage-readability moat beside the entrance path.
  const poison = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  rect(poison, 2, 31, 4, 5);
  rect(poison, 24, 30, 3, 6);
  m.paintWater(poison, 'poison_on_brown');

  m.trigger('quest_sleeping_guardian', 'find_shrine_key', 3, 18, 9, 8);
  m.trigger('quest_dimmed_shrine', 'reach_shrine', 10, 32, 10, 5, false);

  // Transition back to the woods; woods.ts already provides spawn "from_shrine".
  m.door(13, 39, 4, 1, 'woods', 'from_shrine');
  m.spawn('entrance', 15, 36, 'up');
  m.spawn('from_woods', 15, 36, 'up');
  m.spawn('boss_gate', 15, 11, 'up');

  return m.write();
}
