/**
 * Kagehara Village — hub. 40x30 tiles.
 * Layout (tiles): shrine hill top-centre, elder's house NW, dojo NE, shop W, houses E, well square centre,
 * torii gate to the woods at the south edge, pond SE.
 */
import { SceneMap } from '../lib/scene.ts';
import { grid, ellipse, path } from '../lib/builder.ts';

export function buildVillage(): string {
  const m = new SceneMap(
    { id: 'village', displayName: 'Kagehara Village', music: 'village', width: 40, height: 30, seed: 41 },
    ['TilesetFloor', 'TilesetFloorDetail', 'TilesetNature', 'TilesetHouse', 'TilesetWater'],
  );
  const W = m.width;
  const H = m.height;

  // ground: grass everywhere
  m.b.fillPlain(m.ground, 'dirt_on_grass');

  // dirt roads: main N-S road from the shrine to the south gate, E-W road through the square
  const roads = grid(W, H);
  path(roads, [[20, 6], [20, 13], [20, 28]], 3);
  path(roads, [[6, 15], [20, 15], [34, 15]], 3);
  path(roads, [[20, 15], [13, 15], [9, 12]], 2); // to the elder's door
  path(roads, [[20, 15], [27, 15], [31, 10]], 2); // to the dojo
  path(roads, [[9, 15], [6, 19]], 2); // to the shop
  ellipse(roads, 20.5, 15.5, 4.5, 3.2); // village square
  ellipse(roads, 20.5, 6.5, 4, 2.6); // shrine plateau
  m.b.paintTerrain(m.ground, roads, 'dirt_on_grass');

  // pond (SE)
  const pond = grid(W, H);
  ellipse(pond, 32.5, 23.5, 3.6, 2.4);
  m.paintWater(pond, 'water_on_grass');

  // border of trees so nothing needs invisible walls
  m.treeBorder(['tree_round', 'tree_pine', 'tree_round', 'tree_leaning'], 1, (x, y) => y >= H - 2 && x >= 18 && x <= 22);

  // shrine hill (top centre): stone platform + big torii + a dark "unlit" brazier spot made of stones
  m.prop('torii', 19, 9);
  m.prop('stone_pillar', 17, 4);
  m.prop('stone_pillar', 23, 4);
  m.prop('lantern_red', 17, 8);
  m.prop('lantern_red', 23, 8);
  m.prop('rock_grey', 20, 3);
  m.interactable('Shrine', 'shrine_ember', 20, 5, { text: 'The shrine is cold. The ember is gone.' });
  m.solid(20, 5);
  m.prop('tree_big_round', 12, 1);
  m.prop('tree_big_pine', 25, 1);

  // elder's house (NW) with a small garden
  m.prop('house_red', 7, 9);
  m.npc('elder_hana', 9, 13, 'down');
  m.prop('flower_sun', 6, 12);
  m.prop('flower_white', 11, 12);
  m.prop('bush_round', 5, 10);
  m.prop('tree_round', 3, 7);

  // dojo (NE)
  m.prop('house_orange_2', 29, 6);
  m.prop('dojo_sign', 30, 5);
  m.prop('lantern_red', 28, 8);
  m.prop('lantern_red', 33, 8);
  m.npc('master_ryo', 31, 11, 'down');
  m.interactable('Dummy', 'dojo_dummy', 34, 11, { text: 'A straw dummy. Practice your strikes.' });
  m.solid(34, 11);
  m.prop('fence_low_left', 27, 10);
  m.prop('fence_low', 28, 10);
  m.prop('fence_low', 29, 10);
  m.prop('fence_low_right', 30, 10);

  // shop (W)
  m.prop('house_tan', 4, 17);
  m.prop('shop_banner', 5, 16);
  m.prop('crate', 9, 19);
  m.prop('crate', 9, 20);
  m.npc('merchant_botan', 6, 20, 'down', { shop: true });

  // houses (E)
  m.prop('house_orange', 30, 17);
  m.prop('house_orange', 35, 12);
  m.npc('villager_woman', 33, 20, 'left');
  m.npc('villager_man', 27, 20, 'right');
  m.prop('bonsai', 34, 19);

  // village square: well (stone circle) + child
  m.prop('rock_big', 20, 14);
  m.npc('child_mimi', 23, 17, 'left');
  m.prop('flower_red', 17, 17);
  m.prop('flower_sun_2', 24, 13);
  m.sign('sign_square', 22, 14, 'Kagehara Village\nNorth: Shrine   South: Whispering Woods');

  // scattered detail
  const details = ['grass_tuft', 'grass_tuft_2', 'grass_tuft_3', 'fern', 'flower_clover', 'grass_tall', 'pebbles'];
  for (let i = 0; i < 70; i++) {
    const x = 2 + Math.floor(m.b.random() * (W - 4));
    const y = 2 + Math.floor(m.b.random() * (H - 4));
    if (roads[y]?.[x] || pond[y]?.[x] || m.isSolid(x, y) || m.below.get(x, y) !== 0 || m.above.get(x, y) !== 0) continue;
    m.prop(m.b.pick(details), x, y);
  }
  // a few trees inside
  for (const [x, y] of [[14, 22], [26, 24], [10, 25], [36, 4], [3, 3]] as [number, number][]) {
    if (!roads[y]?.[x] && !roads[y + 1]?.[x]) m.prop(m.b.pick(['tree_round', 'tree_pine']), x, y);
  }

  // south gate: torii + guard, exit door to the woods
  m.prop('torii', 19, 26);
  m.npc('guard_goro', 22, 27, 'left');
  m.door(19, 29, 3, 1, 'woods', 'from_village');
  m.spawn('start', 20, 12, 'down');
  m.spawn('from_woods', 20, 27, 'up');
  m.spawn('shrine', 20, 8, 'down');

  return m.write();
}
