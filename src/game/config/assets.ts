// Texture / audio / font keys. One place, so a typo is a compile error not a blank sprite.

export const Tex = {
  // hero
  heroIdle: 'hero_idle',
  heroWalk: 'hero_walk',
  heroAttack: 'hero_attack',
  heroRoll: 'hero_roll',
  heroHit: 'hero_hit',
  heroDead: 'hero_dead',
  heroItem: 'hero_item',
  heroFace: 'hero_face',
  weaponKatana: 'weapon_katana',
  shadow: 'shadow',
  // ui
  font: 'font8x8',
  panel: 'ui_panel',
  panelDark: 'ui_panel_bg_2',
  panelWood: 'ui_panel_2',
  arrowRight: 'ui_arrow_right',
  arrowLeft: 'ui_arrow_left',
  panelInterior: 'ui_panel_interior',
  panelBg: 'ui_panel_bg',
  focus: 'ui_focus',
  hearts: 'ui_hearts',
  dialogBox: 'ui_dialog_box',
  facesetBox: 'ui_faceset_box',
  choiceBox: 'ui_choice_box',
  inventoryCell: 'ui_inventory_cell',
  arrow: 'ui_arrow',
  keyE: 'ui_key_e',
  emoteExclaim: 'ui_emote_exclaim',
  emoteQuestion: 'ui_emote_question',
  lifebarUnder: 'ui_lifebar_under',
  lifebarProgress: 'ui_lifebar_progress',
  // vfx
  fxSlashArc: 'fx_slash_arc',
  fxSlash01: 'fx_slash_01',
  fxSlash03: 'fx_slash_03',
  fxSpark: 'fx_spark',
  fxCircleSpark: 'fx_circle_spark',
  fxSmoke: 'fx_smoke',
  fxSmokeCircular: 'fx_smoke_circular',
  fxExplosion: 'fx_explosion',
  fxAura: 'fx_aura',
  fxBoost: 'fx_boost',
  fxSpirit: 'fx_spirit',
  fxProjShuriken: 'fx_proj_shuriken',
  fxProjPlant: 'fx_proj_plant',
  fxProjEnergy: 'fx_proj_energy',
  fxParticleLeaf: 'fx_particle_leaf',
  fxParticleSpark: 'fx_particle_spark',
  fxParticleRock: 'fx_particle_rock',
  fxParticleGrass: 'fx_particle_grass',
  fxParticleFire: 'fx_particle_fire',
  fxParticleWood: 'fx_particle_wood',
  // items (icons)
  items: 'items', // atlas built at runtime from individual pngs is overkill: each item icon is its own texture `item_<id>`
  chestSmall: 'chest_small',
  chestBig: 'chest_big',
  coinAnim: 'coin_anim',
} as const;

export const itemTexture = (itemId: string): string => `item_${itemId}`;
export const npcTexture = (npcId: string): string => `npc_${npcId}`;
export const enemyTexture = (enemyId: string): string => `enemy_${enemyId}`;
export const tilesetTexture = (name: string): string => name;
export const mapKey = (mapId: string): string => `map_${mapId}`;
export const musicKey = (id: string): string => `music_${id}`;
export const sfxKey = (id: string): string => `sfx_${id}`;

export const Anim = {
  hero: (state: 'idle' | 'walk' | 'attack' | 'roll' | 'hit', dir: string) => `hero_${state}_${dir}`,
  heroDead: 'hero_dead',
  weapon: (dir: string) => `weapon_katana_${dir}`,
} as const;

export const ASSET_ROOT = 'assets/';
