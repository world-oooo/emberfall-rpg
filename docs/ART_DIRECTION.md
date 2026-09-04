# Art Direction

Single asset family: **Ninja Adventure** (Pixel-Boy & AAA, CC0). Nothing from other packs unless it passes the
consistency gate (tile size, perspective, palette, outline, animation style, UI) with at most one "no".

## Rules

| Topic | Decision |
|---|---|
| Tile size | 16×16 |
| Internal resolution | 480×270 (30×16.9 tiles visible). Chosen over 320×180 (too zoomed, HUD cramped) and 640×360 (16 px sprites read as tiny at 3× on 1080p). |
| Scaling | `pixelArt: true`, `Scale.FIT` + `CENTER_BOTH` + `zoom: MAX_ZOOM` (largest integer that fits). 1080p → 4×. Letterbox shows the shell vignette. |
| Filtering | nearest-neighbor only; no `smoothPixelArt`; canvas gets `image-rendering: pixelated` |
| Camera | Custom follow in `update`: exponential smoothing with delta-time, scroll rounded to integers, bounded to the map. No fractional camera zoom, ever. Shake: short (80–140 ms), intensity 0.004–0.01, toggle in settings. |
| Player scale | 1× (16 px body in a 32 px animation frame). Enemies 1×, boss 1× (60 px). Nothing is scaled non-integer. |
| Y-sort | `depth = y` for player, enemies, NPCs, and tall objects placed as sprites; tile layers use fixed depths (Ground 0, Detail 1, BelowPlayer 2, actors 3–9999 by y, AbovePlayer 10000, Foreground 10001, UI 20000). Feet are the pivot: sprite origin (0.5, 1) at the collision box bottom. |
| Palette | Pack palette (`Palette.png`). Tints for feedback: hit flash = FILL white, poison = 0x8bd66b, low HP pulse = 0xe05656. |
| Outlines | Pack style (dark 1 px outline). Generated placeholders must copy it. |
| Shadows | `Actor/Character/Shadow.png` (12×7) under every actor, alpha 0.6, drawn at depth y−1. |
| Effects | Pack FX only (Slash, Spark, Smoke, Explosion, Aura). Particles use `FX/Particle/*` strips. Screen never gets covered; VFX ≤ 1 s. |
| Fonts | HUD/dialogue: pack bitmap font `font8x8.png` (RetroFont, 8 px). Titles: `font24x30.png` is too large; the title uses 8 px font at 2× (integer) or a hand-placed logo. Text always at integer positions, origin 0. |
| Animation FPS | Walk 8 fps, idle 4 fps (2-frame breathing via scale-Y tween is not used — keep sprites unscaled), attack 16 fps, roll 14 fps, enemy telegraphs use tints + squash tweens on *scale* only in whole-pixel steps (0.9/1.1) never rotation. |
| UI | Theme Wood nine-patch panels (`nine_path_panel.png` 16×16, 4 px borders), `DialogBox.png` for dialogue, `Heart.png` strip for HP, `inventory_cell.png` for slots. Warm wood/orange UI on dark translucent backing. |
| Text language | English for the slice; all strings live in data files (`src/game/data/**`) so localization is a data task. |

## Screens must look like one game

Main menu, village, combat, dialogue, inventory, shrine interior, boss: same palette, same font, same panel style, same 16 px scale.
