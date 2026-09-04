/**
 * Multi-tile props expressed as blocks of local tile indices.
 * `above` rows render over the player (canopies, roofs); `below` rows render under the player and block movement
 * where `solid` marks it. Indices verified against the pack tilesets (see tools/assets/tile-crop.py).
 */
export interface PropDef {
  tileset: string;
  /** rows rendered above the player (top of the prop) */
  above: number[][];
  /** rows rendered below the player (base of the prop) */
  below: number[][];
  /** collision mask for the `below` rows (1 = solid), same shape as `below` */
  solid: number[][];
}

const N = 'TilesetNature';
const H = 'TilesetHouse';

export const PROPS: Record<string, PropDef> = {
  tree_round: { tileset: N, above: [[0, 1]], below: [[24, 25]], solid: [[1, 1]] },
  tree_pine: { tileset: N, above: [[2, 3]], below: [[26, 27]], solid: [[1, 1]] },
  tree_dead: { tileset: N, above: [[4, 5]], below: [[28, 29]], solid: [[1, 1]] },
  tree_leaning: { tileset: N, above: [[6, 7]], below: [[30, 31]], solid: [[1, 1]] },
  tree_big_pine: { tileset: N, above: [[-1, 49, 50, 51], [72, 73, 74, 75]], below: [[96, 97, 98, 99]], solid: [[1, 1, 1, 1]] },
  tree_big_round: { tileset: N, above: [[-1, 53, 54, -1], [76, 77, 78, 79]], below: [[100, 101, 102, 103]], solid: [[1, 1, 1, 1]] },
  rock_big: { tileset: N, above: [], below: [[288, 289], [312, 313]], solid: [[1, 1], [1, 1]] },
  rock_grey: { tileset: N, above: [], below: [[295]], solid: [[1]] },
  rock_grey_2: { tileset: N, above: [], below: [[296]], solid: [[1]] },
  rock_tan: { tileset: N, above: [], below: [[316]], solid: [[1]] },
  rock_orange: { tileset: N, above: [], below: [[317]], solid: [[1]] },
  pebbles: { tileset: N, above: [], below: [[299]], solid: [[0]] },
  crystals_blue: { tileset: N, above: [], below: [[294]], solid: [[1]] },
  stump: { tileset: N, above: [], below: [[324, 325], [348, 349]], solid: [[1, 1], [1, 1]] },
  bush_round: { tileset: N, above: [], below: [[241]], solid: [[1]] },
  bush_small: { tileset: N, above: [], below: [[242]], solid: [[1]] },
  bush_round_2: { tileset: N, above: [], below: [[246]], solid: [[1]] },
  bush_berry: { tileset: N, above: [], below: [[343]], solid: [[1]] },
  bush_berry_2: { tileset: N, above: [], below: [[344]], solid: [[1]] },
  bush_berry_3: { tileset: N, above: [], below: [[345]], solid: [[1]] },
  grass_tuft: { tileset: N, above: [], below: [[240]], solid: [[0]] },
  grass_tuft_2: { tileset: N, above: [], below: [[243]], solid: [[0]] },
  grass_tuft_3: { tileset: N, above: [], below: [[244]], solid: [[0]] },
  grass_tall: { tileset: N, above: [], below: [[245]], solid: [[0]] },
  grass_tall_2: { tileset: N, above: [], below: [[271]], solid: [[0]] },
  fern: { tileset: N, above: [], below: [[268]], solid: [[0]] },
  fern_2: { tileset: N, above: [], below: [[269]], solid: [[0]] },
  flower_sun: { tileset: N, above: [], below: [[264]], solid: [[0]] },
  flower_sun_2: { tileset: N, above: [], below: [[265]], solid: [[0]] },
  flower_clover: { tileset: N, above: [], below: [[266]], solid: [[0]] },
  flower_red: { tileset: N, above: [], below: [[267]], solid: [[0]] },
  flower_white: { tileset: N, above: [], below: [[270]], solid: [[0]] },
  mossy_rock: { tileset: N, above: [], below: [[340]], solid: [[1]] },
  mossy_rock_2: { tileset: N, above: [], below: [[341]], solid: [[1]] },
  mossy_rock_3: { tileset: N, above: [], below: [[342]], solid: [[1]] },

  // houses: 4 wide, roof (2 rows) above player, wall row below. Door column marked non-solid.
  house_orange: { tileset: H, above: [[0, 1, 2, 3], [33, 34, 35, 36]], below: [[66, 67, 68, 69]], solid: [[1, 0, 1, 1]] },
  house_tan: { tileset: H, above: [[4, 5, 6, 7], [37, 38, 39, 40]], below: [[70, 71, 72, 73]], solid: [[1, 0, 1, 1]] },
  house_orange_2: { tileset: H, above: [[8, 9, 10, 11], [41, 42, 43, 44]], below: [[74, 75, 76, 77]], solid: [[1, 0, 1, 1]] },
  house_red: { tileset: H, above: [[12, 13, 14, 15], [45, 46, 47, 48]], below: [[78, 79, 80, 81]], solid: [[1, 0, 1, 1]] },
  torii: { tileset: H, above: [[165, 166, 167]], below: [[198, 199, 200]], solid: [[1, 0, 1]] },
  dojo_sign: { tileset: H, above: [], below: [[136, 137]], solid: [[0, 0]] },
  shop_banner: { tileset: H, above: [], below: [[134, 135]], solid: [[0, 0]] },
  lantern_red: { tileset: H, above: [], below: [[105]], solid: [[1]] },
  crate: { tileset: H, above: [], below: [[106]], solid: [[1]] },
  bonsai: { tileset: H, above: [], below: [[104]], solid: [[1]] },
  window_shutter: { tileset: H, above: [], below: [[99]], solid: [[1]] },
  cave_mouth: { tileset: H, above: [[264, 265, 266]], below: [[297, 298, 299]], solid: [[1, 0, 1]] },
  dirt_mound: { tileset: H, above: [], below: [[267, 268, 269], [300, 301, 302]], solid: [[1, 1, 1], [1, 1, 1]] },
  fence_h: { tileset: H, above: [], below: [[141]], solid: [[1]] },
  fence_h_left: { tileset: H, above: [], below: [[140]], solid: [[1]] },
  fence_h_right: { tileset: H, above: [], below: [[142]], solid: [[1]] },
  fence_post: { tileset: H, above: [], below: [[143]], solid: [[1]] },
  fence_low: { tileset: H, above: [], below: [[174]], solid: [[1]] },
  fence_low_left: { tileset: H, above: [], below: [[173]], solid: [[1]] },
  fence_low_right: { tileset: H, above: [], below: [[175]], solid: [[1]] },
  rail_h: { tileset: H, above: [], below: [[209]], solid: [[1]] },
  rail_post: { tileset: H, above: [], below: [[208]], solid: [[1]] },
  stone_wall: { tileset: H, above: [], below: [[273]], solid: [[1]] },
  stone_wall_top: { tileset: H, above: [], below: [[274]], solid: [[1]] },
  stone_pillar: { tileset: H, above: [], below: [[272]], solid: [[1]] },
};

export function propSize(def: PropDef): { w: number; h: number } {
  const rows = [...def.above, ...def.below];
  const w = Math.max(0, ...rows.map((r) => r.length));
  return { w, h: rows.length };
}
