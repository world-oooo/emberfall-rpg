/**
 * Whispering Woods — 60x40. Dark forest between the village (north) and the Hollow Shrine (north-east).
 * A river cuts the map E–W; the only crossing is a plank bridge. Landmarks: the giant hollow tree,
 * the ruined torii, the hermit's hut, a secret grove (Mimi's charm) behind a one-tile gap in the trees.
 */
import { SceneMap } from '../lib/scene.ts';
import { grid, rect, ellipse, path } from '../lib/builder.ts';

export function buildWoods(): string {
  const m = new SceneMap(
    { id: 'woods', displayName: 'Whispering Woods', music: 'woods', width: 60, height: 40, seed: 7 },
    ['TilesetFloor', 'TilesetFloorDetail', 'TilesetNature', 'TilesetHouse', 'TilesetWater', 'TilesetRelief'],
  );
  const W = m.width;
  const H = m.height;

  m.b.fillPlain(m.ground, 'darkdirt_on_darkgrass');

  // road: village gate (top) -> hollow tree -> hermit -> bridge -> ruined torii -> shrine entrance (top right)
  const road = grid(W, H);
  const route: [number, number][] = [
    [30, 0], [30, 8], [24, 12], [18, 16], [16, 22], [18, 27], [27, 30], [27, 36], [34, 36], [44, 32], [48, 24], [50, 14], [50, 8],
  ];
  path(road, route, 2);
  path(road, [[24, 12], [34, 12], [36, 14]], 2); // spur to the giant tree
  path(road, [[16, 22], [10, 24]], 2); // spur to the hermit
  ellipse(road, 30.5, 4.5, 3.5, 2.2); // entrance clearing
  ellipse(road, 37.5, 16.5, 3.5, 2.5); // giant tree clearing
  ellipse(road, 9.5, 25.5, 3.5, 2.5); // hermit clearing
  ellipse(road, 50.5, 9.5, 3, 2.4); // shrine forecourt
  ellipse(road, 46.5, 30.5, 3, 2); // torii clearing
  m.b.paintTerrain(m.ground, road, 'darkdirt_on_darkgrass');

  // river (E-W band with a bend), bridge at x 26-28
  const river = grid(W, H);
  for (let x = 0; x < W; x++) {
    const cy = 32 + Math.round(Math.sin(x / 7) * 1.6);
    for (let y = cy - 1; y <= cy + 1; y++) river[y]![x] = true;
  }
  // keep the bridge cells dry for collision purposes but still draw water around it
  const riverDraw = river.map((r) => r.slice());
  for (let x = 26; x <= 28; x++) for (let y = 29; y <= 35; y++) river[y]![x] = false;
  m.b.paintTerrain(m.water, riverDraw, 'water_on_grass');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (river[y]?.[x]) m.solid(x, y);
  // plank bridge deck (water tileset planks) + rails
  for (let y = 29; y <= 35; y++) {
    m.below.set(26, y, m.b.gid('TilesetWater', 369));
    m.below.set(27, y, m.b.gid('TilesetWater', 369));
    m.below.set(28, y, m.b.gid('TilesetWater', 369));
    m.prop('rail_post', 25, y);
    m.prop('rail_post', 29, y);
  }

  // clearings/areas that must stay free of trees
  const keep = grid(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (road[y]?.[x] || riverDraw[y]?.[x]) rect(keep, x - 1, y - 1, 3, 3);
  rect(keep, 24, 28, 7, 8); // bridge approaches
  rect(keep, 3, 5, 9, 8); // secret grove interior
  rect(keep, 34, 13, 8, 6); // giant tree
  rect(keep, 6, 22, 9, 7); // hermit hut
  rect(keep, 46, 5, 10, 7); // shrine forecourt
  rect(keep, 43, 28, 7, 5); // torii

  // Dense forest everywhere else. Trees are 2x2, so a strict two-tile step made the canopy read as
  // wallpaper; each trunk is nudged by up to one tile and clumped with a noise field so the wood has
  // thickets and gaps instead of a grid.
  const kinds = ['tree_round', 'tree_pine', 'tree_round', 'tree_pine', 'tree_leaning', 'tree_dead'];
  const occupied = grid(W, H);
  const canPlace = (x: number, y: number, edge: boolean): boolean => {
    for (let j = y; j <= y + 1; j += 1) {
      for (let i = x; i <= x + 1; i += 1) {
        if (i < 0 || j < 0 || i >= W || j >= H) return false;
        if (occupied[j]?.[i]) return false;
        if (road[j]?.[i]) return false;
        if (!edge && keep[j]?.[i]) return false;
      }
    }
    return true;
  };
  for (let y = 0; y < H - 1; y += 2) {
    for (let x = 0; x < W - 1; x += 2) {
      const edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
      // Smooth noise creates thickets and clearings rather than an even sprinkle.
      const density = 0.55 + 0.35 * Math.sin(x * 0.31 + y * 0.17) * Math.cos(y * 0.23 - x * 0.11);
      if (!edge && m.b.random() > density) continue;
      const jx = edge ? x : x + (m.b.random() < 0.5 ? 0 : 1);
      const jy = edge ? y : y + (m.b.random() < 0.5 ? 0 : 1);
      if (!canPlace(jx, jy, edge)) continue;
      m.prop(m.b.pick(kinds), jx, jy);
      rect(occupied, jx, jy, 2, 2);
    }
  }
  // secret grove wall: ring of trees with a one-tile gap at (12, 9)
  for (let y = 4; y <= 13; y += 2) {
    if (y !== 8) m.prop('tree_round', 12, y);
    m.prop('tree_pine', 2, y);
  }
  for (let x = 2; x <= 12; x += 2) {
    m.prop('tree_round', x, 3);
    m.prop('tree_pine', x, 13);
  }
  m.clearSolid(12, 8, 2, 2); // the gap (above row of tree at 12,8 removed)
  m.above.set(12, 8, 0);
  m.above.set(13, 8, 0);
  m.below.set(12, 9, 0);
  m.below.set(13, 9, 0);
  m.chest('chest_woods_charm', 6, 8, 'chest_fox_charm');
  m.prop('flower_white', 5, 10);
  m.prop('flower_sun', 8, 10);
  m.prop('mossy_rock', 9, 6);

  // giant hollow tree landmark + chest
  m.prop('tree_big_round', 36, 12);
  m.prop('stump', 41, 15);
  m.chest('chest_woods_tree', 39, 18, 'chest_coins_small');
  m.prop('mossy_rock_2', 34, 18);

  // hermit's hut
  m.prop('house_tan', 7, 20);
  m.npc('hermit_sen', 9, 25, 'down');
  m.chest('chest_woods_hut', 12, 22, 'chest_shuriken');
  m.prop('crate', 6, 24);
  m.prop('lantern_red', 11, 24);

  // ruined torii + shrine entrance (cave mouth into the hill)
  m.prop('torii', 45, 29);
  m.prop('rock_big', 43, 26);
  m.prop('cave_mouth', 49, 4);
  m.prop('lantern_red', 48, 7);
  m.prop('lantern_red', 53, 7);
  m.door(50, 4, 1, 2, 'shrine', 'entrance');
  m.spawn('from_shrine', 50, 8, 'down');

  // enemies: slimes on the road, spore caps guarding the bridge and the grove gap
  m.enemy('slime', 28, 10, 'slime_01');
  m.enemy('slime', 20, 15, 'slime_02');
  m.enemy('slime', 17, 24, 'slime_03');
  m.enemy('slime', 34, 36, 'slime_04');
  m.enemy('slime', 47, 26, 'slime_05');
  m.enemy('slime', 36, 17, 'slime_06');
  m.enemy('mushroom', 30, 28, 'spore_01');
  m.enemy('mushroom', 14, 10, 'spore_02');
  m.enemy('mushroom', 44, 34, 'spore_03');
  m.enemy('mushroom', 51, 17, 'spore_04');

  // quest triggers
  m.trigger('quest_dimmed_shrine', 'reach_woods', 26, 1, 9, 4);
  m.trigger('quest_dimmed_shrine', 'reach_shrine', 47, 6, 8, 5);

  // village exit at the top
  m.door(28, 0, 5, 1, 'village', 'from_woods');
  m.spawn('from_village', 30, 2, 'down');
  m.sign('sign_woods', 33, 4, 'Whispering Woods\nThe river bridge lies south. Shrine to the east.');

  // ambient detail
  const details = ['grass_tuft', 'fern', 'fern_2', 'grass_tall', 'grass_tall_2', 'mossy_rock_3', 'pebbles', 'flower_clover'];
  for (let i = 0; i < 120; i++) {
    const x = 2 + Math.floor(m.b.random() * (W - 4));
    const y = 2 + Math.floor(m.b.random() * (H - 4));
    if (riverDraw[y]?.[x] || m.isSolid(x, y) || m.below.get(x, y) !== 0 || m.above.get(x, y) !== 0) continue;
    m.prop(m.b.pick(details), x, y);
  }

  return m.write();
}
