// Global numeric constants. Anything a designer might tune per-entity lives in data files, not here.

/**
 * Reference resolution. The canvas now fills the browser window and DisplaySystem picks an integer camera
 * zoom, so these are only the design target used when reasoning about layout, not a hard canvas size.
 */
export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 225;
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

/** Timings in ms that define the game feel. Tuned by playtest, not by theory. */
export const Feel = {
  /** Freeze on contact. Light hits barely register as a pause; the finisher and boss hits land hard. */
  hitstopLight: 40,
  hitstopHeavy: 85,
  hitstopBoss: 105,
  hitFlash: 90,
  playerInvulnerable: 800,
  cameraShakeLight: 90,
  cameraShakeHeavy: 170,
  /** Exponential smoothing rate for camera follow (higher = tighter). */
  cameraLerpPerSecond: 14,
  /** Slower smoothing for the look-ahead offset so direction changes never snap the view. */
  cameraLookAheadPerSecond: 2.6,
  /** World pixels the camera leads the player while moving. */
  cameraLookAhead: 22,
} as const;

export const SAVE_VERSION = 1;
export const STORAGE_NAMESPACE = 'emberfall';
