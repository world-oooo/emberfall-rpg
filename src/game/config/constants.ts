// Global numeric constants. Anything a designer might tune per-entity lives in data files, not here.

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const TILE = 16;

/** Render depth bands. Actors use their feet y within the actor band. */
export const Depth = {
  Ground: 0,
  GroundDetail: 1,
  BelowPlayer: 2,
  Shadow: 3,
  ActorBase: 10, // actors: ActorBase + y (world y in px, up to ~10k)
  AbovePlayer: 20000,
  Foreground: 20001,
  Overlay: 30000,
  UI: 40000,
} as const;

/** Physics collision categories (bitmasks handed out by nextCategory are not stable across scenes; we use fixed ones). */
export const Collide = {
  World: 0x0001,
  Player: 0x0002,
  Enemy: 0x0004,
  PlayerHitbox: 0x0008,
  EnemyHitbox: 0x0010,
  Pickup: 0x0020,
  Sensor: 0x0040,
} as const;

/** Timings in ms that define the game feel. */
export const Feel = {
  hitstopLight: 45,
  hitstopHeavy: 90,
  hitFlash: 90,
  playerInvulnerable: 700,
  cameraShakeLight: 90,
  cameraShakeHeavy: 160,
  cameraLerpPerSecond: 12, // exponential smoothing rate
} as const;

export const SAVE_VERSION = 1;
export const STORAGE_NAMESPACE = 'emberfall';
