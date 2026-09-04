# Architecture

Phaser 4.2.1 + TypeScript 5.9 (strict) + Vite 8. Single-player, offline, static build. No backend.

## State model — four kinds, never mixed

| Kind | Lives in | Examples |
|---|---|---|
| **Static game data** | `src/game/data/**` (typed TS objects, `satisfies` checked) | items, enemies, quests, NPCs, dialogue, loot tables, maps registry |
| **Persistent save state** | `SaveGame` object (versioned), stored in IndexedDB via `SaveSystem` | player HP/level/xp/position/map, inventory, equipment, quest states, world flags, opened chests, defeated bosses, playtime |
| **Session state** | `GameSession` (plain class, created on New Game / Continue, passed to scenes) | the live `SaveGame` being played + runtime-only things (current input mode, pending transition) |
| **Scene state** | scene instances | sprites, bodies, tweens, timers — rebuilt from data on every map load |
| **Settings** | `localStorage` (tiny) | volumes, screen shake, fullscreen preference |

Rule: a scene may *read* static data and *mutate* session state through systems; it never stores the truth itself.

## Scenes (5)

```
BootScene      → minimal config, keyboard capture, load boot pack (font, logo, panel)
PreloadScene   → core bundle (player, UI, common SFX) + progress bar + audio unlock hint
MainMenuScene  → New Game / Continue / Settings / Credits
WorldScene     → loads a map bundle by mapId, builds tilemap + entities from Tiled objects, runs gameplay; map changes = fade out → `scene.restart({ mapId, spawnId })` (Phaser tears down every layer/body/tween for us; session state lives outside the scene)
UIScene        → parallel overlay: HUD, dialogue box, inventory, quest log, pause/settings, toasts, hints
```

Per-map asset bundles (`village`, `woods`, `shrine`) are loaded on demand inside WorldScene using `this.load` + `start()`.

## Folder layout

```
src/
  main.ts                      boot the Phaser game, DOM fallback handling
  game/
    config/                    gameConfig.ts, constants.ts (resolution, depths, timings), assetKeys.ts
    core/                      GameSession.ts, events (typed emitter), rng.ts (seedable), Store helpers
    input/                     InputActions.ts (action mapping, keyboard + gamepad → actions)
    scenes/                    Boot, Preload, MainMenu, World, UI
    entities/
      Actor.ts                 shared: sprite + body + shadow + health + hit flash + y-sort
      player/                  Player.ts (+ PlayerStateMachine.ts, PlayerCombat.ts)
      enemies/                 Enemy.ts (base, state machine), behaviours/<archetype>.ts, Boss.ts
      npcs/                    Npc.ts
      props/                   Chest.ts, Door.ts, Sign.ts, Shrine.ts, Prop.ts, Projectile.ts
    combat/                    Health.ts, Damage.ts (DamageInfo), Hitbox.ts, HitFeedback.ts (flash/hitstop/knockback/shake)
    systems/                   InteractionSystem, QuestSystem, InventorySystem, EquipmentSystem, ProgressionSystem,
                               DialogueSystem, LootSystem, AudioSystem, SaveSystem, SettingsStore, MapTransitionSystem
    world/                     MapLoader.ts (Tiled JSON → layers/objects), MapRegistry.ts, ObjectFactory.ts, Spawner.ts
    data/                      items.ts, weapons.ts, enemies.ts, npcs.ts, quests.ts, dialogue/*.ts, loot.ts, maps.ts, strings.ts
    ui/                        widgets (NinePanel, BitmapLabel, Hearts), hud/, dialogue/, inventory/, quest/, menus/
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

- **Actor**: composition over inheritance. `Actor` owns a `Phaser.Physics.Arcade.Sprite`, a `Health`, a shadow, and `HitFeedback`.
  Player/Enemy/NPC extend `Actor` only for behaviour; damage handling lives once in `Health` + `HitFeedback`.
- **Combat**: attacks spawn a short-lived `Hitbox` (Arcade zone with owner, damage, knockback, `hitOnce` set). Overlap Hitbox ↔ Hurtbox (actor body) → `Health.applyDamage(DamageInfo)`. i-frames and hitstop are handled by the receiver's `HitFeedback`.
- **State machines**: small typed FSM (`StateMachine<S>` with `enter/update/exit`) used by Player and Enemy. No generic framework beyond that.
- **Events**: one typed `GameEvents` emitter (`enemyDefeated`, `itemAcquired`, `questUpdated`, `playerHealthChanged`, `coinsChanged`, `levelUp`, `mapChanged`, `dialogueStarted/Ended`). Systems subscribe; scenes emit. Direct calls where a direct dependency is clearer (player → inventory).
- **Interaction**: everything interactable implements `Interactable { prompt, canInteract(session), interact(ctx) }`. The player keeps one `InteractionDetector` (sensor body); no per-type if-chains.
- **Maps**: `MapLoader` reads Tiled JSON: creates tile layers with fixed depths, sets collision from the `Collision` layer, hands object layers to `ObjectFactory`, which instantiates typed entities from `type` + properties. Adding a map = build script + registry entry + assets.
- **Data-driven**: new enemy = data entry + (optional) behaviour file; new item/quest/NPC/dialogue = data only.
- **Save**: `SaveGame` has `saveVersion`; `SaveSystem.load()` runs migrations in order. Saved on: map transition, quest completion, shrine/savepoint interact, boss defeat. Written with idb-keyval (`set` is atomic per key). `navigator.storage.persist()` requested after the first save. Export/Import as JSON text is available in settings.
- **Debug/Test bridge**: `import.meta.env.DEV` gates `window.__GAME_TEST__` (read-only state getters + a few deterministic helpers) and the `?debug=1` overlay. Tree-shaken out of production.

## Performance posture

CPU tilemap layers with culling, ≤ 12 active enemies per map, distance-based enemy update gating (sleep beyond 24 tiles), particle emitters reserved, no per-frame allocations in hot paths (reused Vector2s), audio decoded once. Measure before optimizing.
