# Architecture

Phaser 4.2.1 + TypeScript 5.9 (strict) + Vite 8. Single-player, offline, static build. No backend.

## State model

| Kind | Lives in | Examples |
|---|---|---|
| **Static game data** | `src/game/data/**` (typed TS objects, `satisfies` checked) | items, enemies, quests, NPCs, dialogue, loot tables, maps registry |
| **Persistent save state** | `SaveGame` object (versioned), stored in IndexedDB via `SaveSystem` | player HP/level/xp/position/map, inventory, equipment, quest states, world flags, opened chests, defeated bosses, playtime |
| **Session state** | singleton session in `core/session.ts`, created on New Game / Continue | the live `SaveGame` being played |
| **Scene state** | scene instances | sprites, bodies, tweens, timers — rebuilt from data on every map load |
| **Settings** | `localStorage` | volumes, screen shake, display mode and hints |

Persistent truth lives in the session save. Scene objects are rebuilt on every map load.

## Scenes (5)

```
BootScene      → minimal config, keyboard capture, load boot pack (font, logo, panel)
PreloadScene   → core bundle (player, UI, common SFX) + progress bar + audio unlock hint
MainMenuScene  → New Game / Continue / Settings, plus asset attribution
WorldScene     → loads a map bundle by mapId, builds tilemap + entities from Tiled objects, runs gameplay; map changes = fade out → `scene.restart({ mapId, spawnId })` (Phaser tears down every layer/body/tween for us; session state lives outside the scene)
UIScene        → parallel overlay: HUD, dialogue box, inventory, quest log, pause/settings, toasts, hints
```

The boot and preload scenes load the shared asset set. `WorldScene` rebuilds the selected generated map and its entities on each transition.

## Folder layout

```
src/
  main.ts                      boot the Phaser game, DOM fallback handling
  game/
    config/                    gameConfig.ts, constants.ts (resolution, depths, timings), assetKeys.ts
    core/                      session.ts, typed events and RNG helpers
    input/                     InputActions.ts (action mapping, keyboard + gamepad → actions)
    scenes/                    Boot, Preload, MainMenu, World, UI
    entities/
      player/                  Player.ts and PlayerCombat.ts
      enemies/                 BaseEnemy.ts, BossEnemy.ts (own FSM) and the enemy factory
      props/                   typed interactables, chests and map interactables
    combat/                    Health.ts, Damage.ts (DamageInfo), Hitbox.ts, HitStop.ts, HitFeedback.ts
    systems/                   display, interaction, quests, inventory, progression, audio, save, settings and map transitions
    world/                     map loader, registry and map types
    data/                      items, weapons, enemies, quests, dialogue, loot, maps and strings
    ui/                        reusable nine-slice panel widget
    vfx/                       Effects.ts (slash, spark, smoke, pickup, level-up, death)
    debug/                     DebugOverlay.ts (?debug=1), TestBridge.ts (DEV only, window.__GAME_TEST__)
    types/                     shared TS types & branded IDs
tests/
  unit/                        vitest: pure logic (damage, inventory, quest transitions, loot rng, save migration, dialogue conditions)
  e2e/                         playwright: boot, movement, interaction, combat, save/reload
tools/
  maps/                        map builder DSL + map definitions + validator
  assets/                      curation/extrusion/transcode scripts (Python + Pillow + ffmpeg, dev-time only)
public/assets/                 curated runtime assets (characters, enemies, tiles, maps, items, ui, audio, vfx, fonts)
docs/                          this folder
```

## Key patterns

- **Combat**: attacks spawn a short-lived `Hitbox` (Arcade zone with owner, damage, knockback, `hitOnce` set). Overlap Hitbox ↔ Hurtbox (actor body) → `Health.applyDamage(DamageInfo)`. i-frames and hitstop are handled by the receiver's `HitFeedback`.
- **Events**: one typed `GameEvents` emitter (`enemyDefeated`, `itemAcquired`, `questUpdated`, `playerHealthChanged`, `coinsChanged`, `levelUp`, `mapChanged`, `dialogueStarted/Ended`). Systems subscribe; scenes emit. Direct calls where a direct dependency is clearer (player → inventory).
- **Interaction**: every NPC, chest and map prop implements the same `Interactable` contract. `InteractionSystem` selects the closest valid target and provides one prompt/action path.
- **Maps**: `MapLoader` reads generated Tiled JSON, creates layers and collision, and exposes object layers to `WorldScene` factories. Adding a map means adding a typed builder definition, registry entry and runtime assets.
- **Data-driven**: new enemy = data entry + (optional) behaviour file; new item/quest/NPC/dialogue = data only.
- **Save**: `SaveGame` has a version and is migrated on load. Serialized writes prevent older autosaves from overtaking transition or ending saves. IndexedDB persistence is requested after the first save.
- **Debug/Test bridge**: `import.meta.env.DEV` gates `window.__GAME_TEST__` (read-only state getters + a few deterministic helpers) and the `?debug=1` overlay. Tree-shaken out of production.

## Display

`systems/DisplaySystem.ts` owns window → canvas → camera zoom. The canvas always fills the window
(`Scale.RESIZE`) and the camera zoom is an integer chosen for that window, so pixels stay exact while the
amount of visible world varies within a narrow band. Scenes read `Display.width` / `Display.height` and
subscribe to `Display.onChange` rather than using fixed constants. See [SCREEN_SCALING.md](SCREEN_SCALING.md)
for the chooser and the zoomed-camera scroll convention.

## World state

Anything the world should remember between visits is a flag on the save: `shrine.seal_open`,
`shrine.braziers_lit`, `shrine.vault_open`, `shrine.shortcut_open`, `brazier.<id>`, `ending.relit_shrine`.
`WorldScene.create` replays them — seals reopen their gates, lit braziers get their flame back, and a restored
Ember relights the village shrine. NPC dialogue picks an `<npcId>_after` node when the ending flag is set.

Gates are authored as a `Seal` interactable with `gateX/gateY/gateWidth`, optionally requiring an item
(`requiredItem`) or another flag (`requiredFlag`). The map validator floods through those gate cells so a room
behind a seal is still checked for reachability.

## Performance posture

Tilemap layers use camera culling, maps contain at most ten regular enemies plus one boss, VFX are short-lived,
and audio assets are decoded once. Frame time is measured, not assumed: see [PERFORMANCE.md](PERFORMANCE.md).
Allocation and HUD-update optimisation are deliberately deferred while the game holds 60 fps with p99 under
18 ms on hardware WebGL.
