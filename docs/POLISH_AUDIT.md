# Emberfall — Polish Audit

Before scores were measured on 2026-09-05 against commit `9e373ca`; after scores against `bd20c41` plus the
follow-up UI pass, both from the local dev server in Chromium with the WebGL renderer.
Scale: 1 = broken, 2 = weak, 3 = acceptable, 4 = good, 5 = shippable.

## Overall: 2.9 → 4.1 / 5

The game was always feature-complete and technically healthy. What held it back was presentation and combat
identity: the canvas used less than half the screen on common laptops, the HUD was unstyled text painted over
the world, the boss was a re-skinned regular enemy, and the shrine interior was visually broken.

All of that is addressed. What keeps the score short of 5 is content volume rather than defects: three maps,
one boss, and a single optional puzzle.

## Scores

| Area | Before | After | Evidence |
|---|---|---|---|
| Visual Presentation | 3 | 4 | Framed HUD, repaired interiors, lit shrine ending |
| Screen Scaling | **1** | **5** | 100% window use at all eight tested viewports |
| Pixel Sharpness | 4 | 5 | Integer zoom at every size, no shimmer, extruded tilesets |
| Camera | 3 | 4 | Look-ahead from velocity, arena framing, pixel-snapped |
| Movement Feel | 4 | 4 | Unchanged; it was already good |
| Attack Feel | **2** | 4 | Logic matches the 240 ms animation, buffer, combo, cancel window |
| Roll Feel | **2** | 4 | 300 ms logic against a 214 ms clip stretched to fit |
| Hit Feedback | 3 | 4 | Owned hitstop controller instead of an inverted timeScale |
| Enemy Readability | **2** | 4 | Shaped telegraphs per attack kind, and at most two attackers at once |
| Enemy Variety | 3 | 4 | Hop, kite-and-burst, swoop-and-peel, commit-and-lunge |
| Boss Design | **1** | 4 | Own controller, three attacks, two phases, arena sequence |
| HUD | **1** | 4 | Rounded plates, hearts, level, coins, objective, boss bar |
| Dialogue UI | 2 | 4 | Portrait frame, typewriter, box sized from its longest line |
| Inventory UI | 2 | 4 | Five-column icon grid |
| Quest UX | 3 | 4 | Tracker sized to its text, hidden during boss fights |
| Main Menu | 3 | 4 | Fills the window, Continue slot, readable hints |
| Level Design | 3 | 4 | Shrine rebuilt as carved rooms, village shrine is a real building |
| Exploration | 3 | 4 | Hidden grove, keepers' vault, shortcut |
| World Density | 2 | 4 | Forest jittered off the grid, village hill composed |
| Secrets | 3 | 4 | One per map, each with its own reward |
| Audio | 3 | 4 | Cross-fade between areas, 16 MB → 6.4 MB |
| Loading | 4 | 4 | Cold 1.4–1.5 s, warm 0.4–0.8 s, cache warmed through doors |
| Performance | **5** | **5** | 60 fps, p99 ≤ 17.8 ms in every scene including the boss |
| Save UX | 4 | 4 | Autosave, Continue, world flags persist |
| Accessibility | 3 | 4 | Shake, volume, hints, display mode; still no rebinding |
| Browser Robustness | 4 | 5 | No console errors across the suite, resize handled live |
| Overall Polish | 2 | 4 | Reads as a small finished game rather than a prototype |

## What changed, in priority order

### P0 — screen

`DisplaySystem` replaced a fixed 480×270 canvas with `Scale.RESIZE` plus an integer camera zoom chosen for the
window. Window use went from 45–56% on laptop sizes to 100% everywhere. Details and the full matrix are in
[SCREEN_SCALING.md](SCREEN_SCALING.md).

### P0 — game feel

- Attack timing rebuilt as startup/active/recovery per combo step, with the animation stretched to the exact
  length of its state. The hero no longer freezes on the last frame after each swing.
- Roll cut to 300 ms with 235 ms of invulnerability and a real cooldown.
- Hitstop moved into its own controller. The previous code set `physics.world.timeScale = 0.08`; that property
  is inverted in Arcade Physics, so what was meant as a freeze ran physics roughly twelve times faster.
- Camera look-ahead derived from velocity, and camera zones for framed rooms.

### P0 — boss

The Mask Keeper has its own state machine: swipe, charge and spirit burst, each with a shaped telegraph, plus
a second phase at half health that changes the attack mix and chains combos. Entering the arena locks the
camera, wakes the boss and swaps the music; its death gets hitstop, a flash and silence before the victory cue.

### P1 — enemies

An attack arbiter in `CombatSystem` lets at most two regular enemies be committed to a wind-up or swing at
once; the rest circle. A pack that all swings together is a wall of damage with nothing to read. Each
archetype now moves differently as well: the slime hops, the Sporecap backs off and bursts at range, the bat
swoops and peels away during its cooldown, and the Hollow Guard steps through its swing so the strike reads as
an attack you dodge rather than contact damage you walk into.

### P1 — UI and world

Every surface is laid out from `Display.width/height` and re-anchors on resize. The shrine was rebuilt as
rooms carved from solid rock. The village shrine — the emotional centre of the story — was an invisible
collision tile on bare dirt and is now an actual building, which the ending lights.

### P2 — QA

Fifteen end-to-end tests, sixteen unit tests, map validation, a scripted screenshot baseline and a scripted
measurement pass. See [TESTING.md](TESTING.md).

## Measured data

### Viewport matrix

| Viewport | Before: canvas / used | After: canvas / zoom / used |
|---|---|---|
| 1280×720 | 960×540 / 56.3% | 1280×720 / 4× / 100% |
| 1366×768 | 960×540 / **49.4%** | 1366×768 / 4× / 100% |
| 1440×800 | 960×540 / **45.0%** | 1440×800 / 4× / 100% |
| 1440×900 | 1440×810 / 90.0% | 1440×900 / 4× / 100% |
| 1536×864 | 1440×810 / 87.9% | 1536×864 / 4× / 100% |
| 1600×900 | 1440×810 / 81.0% | 1600×900 / 5× / 100% |
| 1920×1080 | 1920×1080 / 100% | 1920×1080 / 5× / 100% |
| 2560×1440 | 2400×1350 / 87.9% | 2560×1440 / 7× / 100% |

### Performance

Locked 60 fps on hardware WebGL in every scene, boss fight included. Full tables, the software-rasteriser
comparison and the transition benchmark are in [PERFORMANCE.md](PERFORMANCE.md).

## Defects found by the audit and fixed

Recorded because each was invisible from reading the code alone:

1. Hitstop ran physics ~12× faster instead of freezing it (inverted `timeScale`).
2. The sealed stair was a `shrine → shrine` teleport whose destination sat on its own trigger, so the arena
   could softlock the player.
3. `AudioSystem` tweened a `Sound` a scene restart had destroyed mid-fade, throwing on transitions.
4. The boss camera zone was smaller than the view, so the arena showed black void outside the map.
5. Neighbour prefetch queued into the scene loader and raced with transitions: "Texture key already in use".
6. Wrapped dialogue lines were drawn on top of the choice list.
7. Two shrine quest triggers named objectives their quest does not define, so they were dead.
8. Opening a seal stripped the tile from every layer including Ground, punching a black hole in the floor.
9. The quest tracker's text overflowed its rounded plate and its plate ignored wrapped objective lines.
10. The boss health bar overlapped the heart plate at 320 logical pixels wide.

## Comparison references

- **Hyper Light Drifter** — attack and dash resolve inside the animation; input never outlives what you see.
- **CrossCode** — every enemy attack has a distinct wind-up pose and colour before it lands.
- **Eastward** — interiors are built from varied tiles and warm light, never one repeated floor tile.
- **Moonlighter** — HUD sits in framed panels that belong to the art, not floating text.
- **TUNIC** — the boss arena is a separate space with a door, a name and its own music.
- **Death's Door** — bosses telegraph slowly and leave a clear punish window after each attack.
- **Minishoot' Adventures** — the camera shows a consistent amount of world at every window size.

## What is still weak

- **Content volume.** Three maps and one boss. That is the deliberate scope, but it caps the ceiling.
- **No input rebinding.** Keyboard layouts are generous but fixed.
- **One puzzle.** The brazier vault is the only non-combat problem in the game.
