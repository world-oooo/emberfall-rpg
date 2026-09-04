# Research Log (M0, verified 2026-09-04/05)

Tier A = official docs · B = official repo/examples · C = maintained OSS · D = experienced-dev course · E = legacy architecture · F = community.
Each entry: Source · Version/Date · Category · Why useful · What to learn · What NOT to copy · Current/Legacy.

## Engine

| Source | Version / Date | Tier | Why useful | Learn | Don't copy | Status |
|---|---|---|---|---|---|---|
| [phaser npm](https://www.npmjs.com/package/phaser) / [releases](https://github.com/phaserjs/phaser/releases) | 4.2.1 "Giedi", 2026-07-09 (4.0.0 2026-04-10, 4.1.0 04-30, 4.2.0 06-19) | A | Pin the real current version; types ship in-package (`types/phaser.d.ts`) | Use named imports; 4.0.0 ESM lacked default export (fixed 4.1.0) | `latest` ranges; 4.0.0 | Current |
| [Official Agent Skills](https://github.com/phaserjs/phaser/tree/master/skills) (28 folders, vendored to `.claude/skills/phaser-*`) | master, 2026-09 | B | Authoritative API notes per subsystem | tilemaps: tileset/layer names must match Tiled; CPU vs GPU layer; `setCollisionByProperty`. physics-arcade: static bodies need `refreshBody`, `overlap` vs `collide`, categories. cameras: `startFollow` roundPixels arg, deadzone, effects. scale: FIT+CENTER_BOTH+MAX_ZOOM pixel-art recipe. animations: global anims, `frameRate` beats `duration`, `play(key,true)`. text: BitmapText for crisp/fast text, RetroFont. loading: bundles, `load.start()` outside preload, `[ogg,mp3]` | Blog-era Phaser 3 snippets | Current |
| [v4 Migration Guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md) | 4.0.0 | A | Avoid removed APIs | `setTintFill` → `setTint(c).setTintMode(TintModes.FILL)`; `Geom.Point` → `Vector2`; FX → `filters.internal/external`; `Math.TAU` is now 2π; `roundPixels` default false; Canvas renderer deprecated | preFX/postFX pipelines, BitmapMask | Current |
| [Phaser 4 Pixel Art Guide](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md) + `Camera.js` source | master | A/B | Crisp rendering rules | `pixelArt:true` ⇒ antialias off + roundPixels on; rounding only works at **integer camera zoom**; `startFollow(target, roundPixels=false)` silently resets camera rounding → pass `true` or snap manually; keep Text origin 0 at integer positions | `smoothPixelArt` together with `pixelArt` | Current |
| Phaser issues [#7331](https://github.com/phaserjs/phaser/issues/7331), [#7317](https://github.com/phaserjs/phaser/issues/7317), [#7352](https://github.com/phaserjs/phaser/issues/7352), [#7341](https://github.com/phaserjs/phaser/issues/7341), [#7252](https://github.com/phaserjs/phaser/issues/7252) | Jun–Aug 2026, open | B | Known 4.x regressions | GPU tilemap layers break animated tiles and show seams → use CPU layers; camera lerp is framerate-dependent → custom delta-based follow; angle tweens on per-frame-moved objects corrupt batches → rotate manually; arcade tile separation leaves fractional positions → round render positions | TilemapGPULayer for now | Current |
| [template-vite-ts](https://github.com/phaserjs/template-vite-ts) | v1.4.0, pins phaser 4.0.0, Vite 6, TS 5.7 (2026-04) | B | Project shape (index.html, `#game-container`, manualChunks phaser) | `base:'./'`, phaser manual chunk, DOMContentLoaded boot | `log.js` telemetry ping, stale pins | Current but stale pins |

## Level pipeline

| Source | Version / Date | Tier | Why useful | Learn | Don't copy | Status |
|---|---|---|---|---|---|---|
| [Tiled JSON map format](https://doc.mapeditor.org/en/stable/reference/json-map-format/) | Tiled 1.12.2, 2026-05-27 | A | Contract for generated maps | orthogonal, `infinite:false`, CSV `data`, embedded tilesets, `properties:[{name,type,value}]`, object field is `type` again since 1.10 (`class` only in 1.9), tile objects anchor bottom-left → use point/rect objects; flip flags in top 4 GID bits | external `.tsx` (Phaser parser warns "External tilesets unsupported") | Current |
| Phaser `ParseTilesets.js` / `ParseObject.js` | master | B | What the parser really reads | tile `properties` folded to an object (so `collides:true` works); object `properties` stay an array → helper `prop(obj,name)`; `createFromObjects` is the only place the bottom-left origin is fixed | — | Current |
| [tile-extruder](https://github.com/sporadic-labs/tile-extruder) | community | F | Seams at 3–4× zoom | Extrude 1 px → tileset `margin 1, spacing 2`; we do this in our own Pillow script | — | Current |

## RPG architecture references

| Source | Version / Date | Tier | Why useful | Learn | Don't copy | Status |
|---|---|---|---|---|---|---|
| [remarkablegames/phaser-rpg](https://github.com/remarkablegames/phaser-rpg) | Phaser 4.2.1, TS 6, Vite 8; commit 2026-09-04 | C | Only Phaser 4 + TS + Vite RPG starter | `BelowPlayer/World/AbovePlayer` layers, `setCollisionByProperty`, spawn from object layer, depth constants, facing "selector" body for interaction, velocity normalize | phaser-jsx UI; no systems | Current |
| [RPGJS v5](https://github.com/RSamaium/RPG-JS) | 5.0.0-beta.33, 2026-08-20 | C | Vocabulary + save-slot shape | database/map/event split; save slot metadata `{level, map, date}` + snapshot; attack windows startup/active/recovery; enemy FSM Idle/Alert/Combat/Flee/Stunned | The framework itself: CanvasEngine+Vue renderer, server-authoritative loop, beta | Current, rejected (ADR-001) |
| [Grid Engine](https://github.com/Annoraaq/grid-engine) | 2.52.1, 2026-05-16, peer `phaser ~4.0.0` | C | Would matter for grid movement | — | Grid movement for a free-movement ARPG; peer range excludes 4.2.1 | Current, rejected |
| [Scott Westover — Legend of the Wispguard (Zelda-like, Phaser 3)](https://github.com/devshareacademy/phaser-zelda-like-tutorial) | Phaser 3.87, 2025-03→08; 42 lesson tags | D | Proven build order + component/FSM architecture | Order: player → input → FSM → components → enemies → life → chests/interactables → Tiled → collision → doors/camera → transitions → inventory → attack/weapons → data manager → HUD/dialog → boss. Weapon body enabled only during swing; `EVENT_BUS`; UI scene launched in parallel; state in module singletons outside scenes | Phaser 3 API (`setTintFill`), no `onExit`, enemy type magic ints, no persistence, fixed depths without y-sort | Legacy API, current design |
| [Phaser 4 mini course](https://phaser.io/news/2026/04/phaser-4-mini-course-beginners) | 2026-05, Phaser 4.1 | D | Confirms 4.x scene/input basics | Scene lifecycle in v4 unchanged | Not RPG | Current |
| [danielart/phaser-rpg-template](https://github.com/danielart/phaser-rpg-template) | Phaser 3.55, 2022-08 | E | Enums for layer/object types, door target as Tiled property | Door destination in map data; global emitter | Scene-per-map + `scene.switch` (sleeping scenes pile up), GridEngine coupling | Legacy |
| [BrowserQuest](https://github.com/mozilla/BrowserQuest) | archived 2024-01 | E | Simulation/renderer split, data tables outside entities, area-based spawning | `entity→character→player/mob/npc`, `properties.js` tables, spawn areas | 2012 RequireJS, netcode | Legacy |
| [grievy-towns-dilemma](https://github.com/Maxime-Garcia/grievy-towns-dilemma) (no license), [dungeon-crawler-now](https://github.com/JohnVonDrashek/dungeon-crawler-now) (MIT), [monster-tamer](https://github.com/devshareacademy/monster-tamer) (MIT) | 2025–2026, Phaser 3 | C | Systems folder layout, versioned save, `PlayerAttackManager` split, save schema shape | `types → data → systems → scenes`; versioned save; attack logic separated from Player | Unlicensed code | Current (Phaser 3) |
| [ourcade FSM post](https://blog.ourcade.co/posts/2021/character-logic-state-machine-typescript/) | 2021 | D | Typed FSM shape | `onEnter/onUpdate/onExit`, queued transitions | — | Current |

## Testing / storage / deploy

| Source | Version / Date | Tier | Why useful | Learn | Don't copy | Status |
|---|---|---|---|---|---|---|
| [Playwright](https://playwright.dev/docs/test-webserver) | 1.62.1 (Chromium 151) | A | Canvas-game e2e | `webServer` on `vite preview`; `keyboard.down/up` holds; `page.on('pageerror'/'console')`; `waitForFunction` on `window.__GAME_TEST__`; headless WebGL needs `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader` (Chromium 139+ removed automatic fallback) — assert renderer type in a smoke test | DOM-only assertions | Current |
| [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) / [locator assertions](https://playwright.dev/docs/api/class-locatorassertions) | verified 2026-09-05 | A | Stable canvas screenshots | Prefer `expect(locator).toHaveScreenshot()` because it waits for two stable frames; disable animation or mask volatile HUD/debug content | One-off screenshots as the only gameplay proof | Current |
| [Anthropic webapp-testing skill](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | 2026, Apache-2.0 | B | Python `with_server.py` + sync Playwright recon flow | Server-wrapper idea; screenshot-then-act loop | DOM-centric recon for a single canvas | Current, optional aid |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | 6.3.0, 2026-07, Apache-2.0, ~300 B | C | Simplest robust IndexedDB | `createStore`, `get/set` | raw IndexedDB boilerplate | Current |
| [idb-keyval README](https://github.com/jakearchibald/idb-keyval/blob/main/README.md) / [navigation freeze report](https://github.com/jakearchibald/idb-keyval/issues/180) | 6.3.0, verified 2026-09-05 | B/C | Save correctness and lifecycle risk | Persist structured-clonable snapshots; use `update()` for atomic read-modify-write when needed; save during explicit game events | Large IndexedDB writes from `beforeunload` or navigation teardown | Current |
| [MDN storage quotas/persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) | 2026 | A | Saves can be evicted | Private mode = memory only; Safari 7-day eviction; call `persist()`; offer export/import | assuming permanence | Current |
| [Vite static deploy](https://vite.dev/guide/static-deploy) / [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite) | Vite 8.2.2 | A | Zero-config static build | keep hashed bundle dir separate from un-hashed game data (`build.assetsDir: 'bundle'`, data in `public/assets`); no SPA rewrite needed; immutable cache headers only on hashed files | — | Current |
| Phaser KeyboardPlugin capture | 4.1 docs | A | Stop page scrolling | `addCapture([...])` in Boot; keyboard target is `window` so no canvas focus needed | — | Current |

## Assets

| Source | Version / Date | Tier | Why useful | Learn | Don't copy | Status |
|---|---|---|---|---|---|---|
| [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) | Update #8 2026-03-29; zip 89 MB, 2,674 files | B | Primary art/audio family, CC0 (page + LICENSE.txt) | 16×16 sheets, columns = Down/Up/Left/Right, rows = frames; `Actor/CharacterAnimated/NinjaGreen` has 32×32-frame attack/roll/hit/dead; monsters 64×64 (4×4); bosses are strips (GiantRacoon 60×60 frames: Idle 6, Charge 2, Attack 4, Jump 5); tilesets 16 px, no spacing; `Ui/Theme/Theme Wood` nine-patch; `Ui/Font/font8x8.png` 15 glyphs/row ASCII from space; 40 OGG music, 130 WAV SFX | Entire pack into `public/` (109 MB) | Current |
| [Kenney](https://kenney.nl) Tiny Dungeon / Tiny Town / RPG Urban / UI RPG Expansion / RPG Audio / Impact / UI Audio | CC0 | B | Fallbacks (16×16) | Only through the consistency gate | Style mixing | Current, unused so far |
| Fonts: Press Start 2P (OFL), Silkscreen (OFL), m5x7 (CC0), Pixel Operator (CC0) | 2026 | B | If a proportional/UTF-8 font is needed later | Generate a bitmap font atlas from an OFL/CC0 TTF | — | Reserved |

## Design references (principles only, nothing copied)

- **2D Zelda**: readable rooms, one-input interaction language, chests visible before reachable.
- **CrossCode / Hyper Light Drifter**: hit feedback stack (flash → spark → knockback → hitstop → tiny shake), dash with i-frames, telegraph before every enemy attack.
- **Stardew Valley**: warm top-down town readability, short NPC lines that change with state.
- **Moonlighter**: dungeon → town loop where money has an obvious use (one better weapon, potions for the boss).
- **Pokémon**: item/quest data readability; stable IDs; menus that answer "what does this do" in one line.
