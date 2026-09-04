# Tiled Conventions

Maps are Tiled-format JSON (Tiled ≥ 1.10 schema: orthogonal, `infinite: false`, CSV `data`, embedded tilesets,
objects carry `type` and a `properties` array). They are **generated** by `tools/maps/*.ts` (no Tiled GUI is
installed on the dev machine) but stay fully openable/editable in Tiled. Output goes to `public/assets/maps/<mapId>.json`.

## Tilesets

Curated, **extruded** copies of the pack tilesets live in `public/assets/tiles/<name>.png` (1 px extrusion →
`margin: 1, spacing: 2` in the tileset definition; this is what stops seams at 3–4× zoom).
Tileset `name` in the map JSON == Phaser texture key (e.g. `TilesetFloor`).

## Tile layers (all optional except Ground and Collision)

| Layer | Depth | Notes |
|---|---|---|
| `Ground` | 0 | base terrain (grass/dirt/stone/water) |
| `GroundDetail` | 1 | flowers, cracks, puddles |
| `BelowPlayer` | 2 | rugs, paths, fences bottoms |
| `Objects` | y-sorted | **not a tile layer** — tall props (trees, statues, houses) that need Y-sort are placed as `Prop` objects and become sprites |
| `AbovePlayer` | 10000 | tree canopies, roofs, arches |
| `Foreground` | 10001 | fog/light overlays if any |
| `Collision` | hidden | single solid tile (`TilesetLogic` red block) marks blocked cells. The only source of truth for static blocking. |

## Object layers and object `type`s

All objects are **point** or **rectangle** objects (no tile objects, so `x,y` is top-left/exact and no origin surprises).

| Layer | type | properties |
|---|---|---|
| `Spawns` | `PlayerSpawn` | `spawnId` (string), `facing` (`down/up/left/right`) |
| `Enemies` | `EnemySpawn` | `enemyId`, `spawnId`, `respawn` (`always/once/never`) |
| `NPCs` | `NPC` | `npcId`, `facing` |
| `Doors` | `Door` (rect) | `destinationMap`, `destinationSpawn`, `locked` (bool), `requiredItem` (string, optional), `lockedMessage` |
| `Chests` | `Chest` | `chestId`, `lootTable` |
| `Triggers` | `QuestTrigger` (rect) | `questId`, `objectiveId`, `once` (bool) |
| `Interactables` | `Sign` / `Shrine` / `Dummy` / `Savepoint` | `interactionId`, `text` (Sign), `facing` |
| `Props` | `Prop` | `sprite` (texture key), `frame` (int), `solid` (bool) — Y-sorted tall props |
| `Audio` | `AudioZone` (rect) | `trackId`, `fade` (ms) |
| `Camera` | `CameraBounds` (rect) | restricts the camera inside sub-areas (boss arena) |

Map-level properties: `mapId`, `displayName`, `music`, `ambient` (optional), `tint` (optional hex for indoor darkness).

## IDs

Stable snake_case: `village`, `woods`, `shrine`; `spawn_from_village`; `chest_woods_01`; `npc_elder_hana`.
Display names never act as keys.

## Validation

`npm run maps:validate` checks: unique `spawnId`/`chestId`, every `Door.destinationMap` + `destinationSpawn` exists,
every `enemyId`/`npcId`/`questId`/`lootTable`/`sprite` exists in game data, Collision layer present, no tile GID exceeds
its tileset, map properties present.
