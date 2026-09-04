/** Sound effect ids (files under public/assets/audio/sfx/<id>.ogg|mp3). */
export const SFX_IDS = [
  'attack_swing',
  'attack_swing2',
  'attack_swing3',
  'hit',
  'hit2',
  'hit_heavy',
  'player_hurt',
  'enemy_death',
  'roll',
  'throw',
  'pickup',
  'coin',
  'heal',
  'level_up',
  'quest_complete',
  'secret',
  'game_over',
  'chest_open',
  'door',
  'menu_move',
  'menu_accept',
  'menu_cancel',
  'dialogue_blip',
  'alert',
  'boss_roar',
  'slam',
  'spore',
  'bat',
  'bone',
  'fire_light',
  'magic',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

/** Music ids (public/assets/audio/music/<id>.ogg). */
export const MUSIC_IDS = ['title', 'village', 'woods', 'shrine', 'boss', 'victory'] as const;
export type MusicId = (typeof MUSIC_IDS)[number];
