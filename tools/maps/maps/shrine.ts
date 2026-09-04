/**
 * Hollow Shrine — 30x40. Interior dungeon: entry hall, key side room, bat gallery, sealed stair, boss arena.
 *
 * The whole map starts as solid brick and the rooms are carved out of it. That gives every room a real wall
 * mass instead of decorative frames floating on an open floor, and it means collision and visuals can never
 * disagree: if a cell is not carved, it is both brick and solid.
 */
import { SceneMap } from '../lib/scene.ts';
import { rect } from '../lib/builder.ts';

const FLOOR = 'TilesetInteriorFloor';
const DUNGEON = 'TilesetDungeon';
const INTERIOR = 'TilesetInterior';

/** Plain orange brick used for the rock mass. */
const BRICK = 185;
/** Cold sage stone for walkable floor, with quiet variants so large rooms are not one flat colour. */
const FLOOR_BASE = 253;
const FLOOR_VARIANTS = [253, 253, 253, 253, 253, 253, 253, 231];
/** Concentric ring that marks the centre of the guardian arena. */
const FLOOR_RING = 193;
const FLOOR_STAR = 256;

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function buildShrine(): string {
  const m = new SceneMap(
    { id: 'shrine', displayName: 'Hollow Shrine', music: 'shrine', tint: '#6f7f72', width: 30, height: 40, seed: 19 },
    ['TilesetInteriorFloor', 'TilesetWallSimple', 'TilesetInterior', 'TilesetDungeon', 'TilesetWater', 'TilesetElement'],
  );
  const W = m.width;
  const H = m.height;

  // 1. Solid rock everywhere.
  const brickGid = m.b.gid(FLOOR, BRICK);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) m.ground.set(x, y, brickGid);
  m.solid(0, 0, W, H);

  // 2. Carve the rooms and corridors.
  const rooms: Room[] = [
    { x: 10, y: 31, w: 10, h: 8 }, // entrance hall
    { x: 8, y: 23, w: 14, h: 8 }, // lower hall
    { x: 3, y: 17, w: 9, h: 8 }, // key room
    { x: 18, y: 16, w: 8, h: 8 }, // bat gallery
    { x: 12, y: 14, w: 6, h: 8 }, // sealed stair
    { x: 5, y: 1, w: 20, h: 12 }, // guardian arena
  ];
  const corridors: Room[] = [
    { x: 13, y: 30, w: 4, h: 2 }, // entrance -> lower hall
    { x: 11, y: 21, w: 3, h: 3 }, // lower hall -> key room
    { x: 19, y: 21, w: 3, h: 3 }, // lower hall -> bat gallery
    { x: 13, y: 12, w: 4, h: 3 }, // sealed stair -> arena
    { x: 13, y: 21, w: 4, h: 3 }, // lower hall -> sealed stair
  ];
  const walkable = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  for (const room of [...rooms, ...corridors]) {
    rect(walkable, room.x, room.y, room.w, room.h);
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!walkable[y]?.[x]) continue;
      m.ground.set(x, y, m.b.gid(FLOOR, m.b.pick(FLOOR_VARIANTS)));
      m.clearSolid(x, y);
    }
  }
  // The doorway out to the woods stays open at the bottom.
  for (let x = 13; x <= 16; x += 1) {
    for (let y = 39; y <= 39; y += 1) {
      m.ground.set(x, y, m.b.gid(FLOOR, FLOOR_BASE));
      m.clearSolid(x, y);
    }
  }

  const arena = rooms[5]!;

  // 3. Arena floor motif so the climax room reads as a place, not a corridor.
  const cx = arena.x + Math.floor(arena.w / 2);
  const cy = arena.y + Math.floor(arena.h / 2);
  m.ground.set(cx, cy, m.b.gid(FLOOR, FLOOR_RING));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
    m.ground.set(cx + dx, cy + dy, m.b.gid(FLOOR, FLOOR_STAR));
  }

  // 4. Sparse floor detail. The previous pass scattered empty tiles that rendered as black holes; these are
  // real cracked-stone tiles, kept rare so the floor still reads as one surface.
  for (let i = 0; i < 26; i += 1) {
    const x = 1 + Math.floor(m.b.random() * (W - 2));
    const y = 1 + Math.floor(m.b.random() * (H - 2));
    if (!walkable[y]?.[x] || m.isSolid(x, y)) continue;
    if (x === cx && y === cy) continue;
    m.ground.set(x, y, m.b.gid(FLOOR, m.b.pick([231, 231, 231, 256])));
  }

  // 5. Props. Braziers light the path; statues mark rooms and give the arena cover.
  const brazier = (x: number, y: number): void => {
    m.below.set(x, y, m.b.gid(DUNGEON, 41));
    m.solid(x, y);
  };
  const statue = (x: number, y: number, broken = false): void => {
    m.below.set(x, y, m.b.gid(DUNGEON, broken ? 43 : 27));
    m.solid(x, y);
  };
  /** Two tiles tall so a column reads as a column rather than a brick patch on the floor. */
  const pillar = (x: number, y: number): void => {
    m.above.set(x, y - 1, m.b.gid(FLOOR, BRICK));
    m.below.set(x, y, m.b.gid(FLOOR, BRICK));
    m.solid(x, y);
  };
  const crate = (x: number, y: number): void => {
    m.below.set(x, y, m.b.gid(DUNGEON, 14));
    m.solid(x, y);
  };

  // Entrance hall: first light, a hint of what waits above.
  brazier(11, 37);
  brazier(18, 37);
  crate(12, 33);
  statue(17, 33, true);
  m.sign('sign_shrine_entry', 15, 35, 'Hollow Shrine\nThe guardian sleeps at the top of the stair.');

  // Lower hall: first shrine fight, pillars to break line of sight.
  pillar(11, 26);
  pillar(18, 26);
  brazier(9, 24);
  brazier(20, 24);
  statue(9, 29, true);
  statue(20, 29, true);
  m.enemy('skeleton', 12, 26, 'shrine_skeleton_01');
  m.enemy('skeleton', 17, 25, 'shrine_skeleton_02');

  // Key room: the shrine key, guarded.
  pillar(5, 19);
  pillar(9, 19);
  brazier(4, 18);
  brazier(10, 18);
  statue(6, 23);
  m.chest('chest_shrine_key', 7, 19, 'chest_shrine_key');
  m.enemy('bat', 6, 22, 'shrine_bat_01');
  m.enemy('skeleton', 9, 22, 'shrine_skeleton_03');

  // Bat gallery: airy room, supplies at the back.
  pillar(20, 18);
  pillar(24, 18);
  brazier(19, 22);
  brazier(25, 22);
  m.chest('chest_shrine_supplies', 22, 21, 'chest_potion');
  m.enemy('bat', 21, 19, 'shrine_bat_02');
  m.enemy('bat', 24, 20, 'shrine_bat_03');

  // Sealed stair: the gate to the guardian.
  brazier(13, 16);
  brazier(16, 16);
  statue(13, 19, true);
  statue(16, 19, true);
  m.enemy('skeleton', 15, 18, 'shrine_skeleton_04');
  m.door(13, 13, 4, 1, 'shrine', 'boss_gate', {
    locked: true,
    requiredItem: 'shrine_key',
    lockedMessage: 'A cold seal bars the way. The shrine key should fit here.',
  });
  m.sign('sign_shrine_seal', 15, 15, 'The guardian sleeps beyond the sealed stair.');

  // Guardian arena: four pillars for cover, braziers along the back wall, ember pedestal behind the boss.
  pillar(9, 4);
  pillar(20, 4);
  pillar(9, 9);
  pillar(20, 9);
  brazier(6, 2);
  brazier(23, 2);
  brazier(6, 11);
  brazier(23, 11);
  statue(12, 2);
  statue(17, 2, true);
  m.enemy('boss_racoon', 15, 6, 'guardian_tanuki', 'never', { boss: true, questId: 'quest_sleeping_guardian' });
  m.interactable('Shrine', 'ember_pedestal', 15, 2, { text: 'The stolen ember waits here, warm enough to carry home.' });
  m.below.set(15, 2, m.b.gid(INTERIOR, 74));
  m.solid(15, 2);
  m.trigger('quest_sleeping_guardian', 'enter_boss_arena', arena.x, arena.y, arena.w, arena.h);
  m.cameraBounds('boss_arena', arena.x, arena.y, arena.w, arena.h);

  // Quest triggers and transitions.
  m.trigger('quest_sleeping_guardian', 'find_shrine_key', 3, 17, 9, 8);
  m.trigger('quest_dimmed_shrine', 'reach_shrine', 10, 33, 10, 5, false);
  m.door(13, 39, 4, 1, 'woods', 'from_shrine');
  m.spawn('entrance', 15, 37, 'up');
  m.spawn('from_woods', 15, 37, 'up');
  m.spawn('boss_gate', 15, 13, 'up');

  return m.write();
}
