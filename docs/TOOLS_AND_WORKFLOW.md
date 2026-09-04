# Tools, Skills and Workflow Record

This file records the project inputs and working methods needed to understand or continue Emberfall. It intentionally documents reproducible project knowledge without copying private machine configuration, credentials or transient agent state.

## Original handoff

- `Claude Fable 5.1용 2D Web RPG 제작 마스터 프롬프트.md` — original production brief.
- `docs/GAME_DESIGN.md` — world, combat, enemies, quests, items and vertical-slice acceptance path.
- `docs/ART_DIRECTION.md` and `DESIGN.md` — pixel-art palette, layout, UI and interaction rules.
- `docs/ADR/` — engine, save-storage and UI architecture decisions.
- `docs/TILED_CONVENTIONS.md` — generated-map object and property conventions.

## Repository-local agent skills

The complete Phaser reference skills used by the original Claude workflow are committed under `.claude/skills/`. They cover:

- Phaser 4 setup, migration and new APIs.
- Scenes, loading, cameras, scaling and responsive rendering.
- Arcade/Matter physics, tilemaps, geometry and math.
- Keyboard/mouse/touch input, events, data manager and timers.
- Sprites, animations, text/BitmapText, containers and render textures.
- Audio, particles, tweens, curves, graphics, filters and utility actions.

Each skill retains its own `SKILL.md`; the larger topics also include a `references/REFERENCE.md`. These files are project references, not runtime dependencies.

## Completion workflows used

- **Design workflow** — converted the inherited visual direction into the root `DESIGN.md` contract before final UI work.
- **Autoresearch goal workflow** — repeatedly compared implementation and browser evidence against a completion rubric until it passed.
- **Browser/local-web workflow** — inspected the actual WebGL canvas, panels and generated maps in a running browser.
- **Parallel specialist agents** — separated map construction, combat, interaction, RPG systems and runtime verification into bounded work lanes, followed by one integration pass.

Local workflow state under `.omx/`, browser scratch files and test artifacts are excluded from Git because they are machine-specific evidence, not source inputs. Durable conclusions from those runs are preserved in `docs/RESEARCH.md`, `docs/TESTING.md` and `docs/TASKS.md`.

## Runtime and build tools

| Tool | Role |
| --- | --- |
| Phaser 4.2.1 | WebGL game engine, scenes, Arcade physics, tilemaps, input and audio |
| TypeScript 5.9 | Strict source checking and typed game data |
| Vite 8 | Development server and static production bundle |
| idb-keyval 6.3 | IndexedDB save persistence |
| Vitest 5 | Unit tests for pure game systems |
| Playwright 1.62 | Real-browser WebGL and full-story acceptance tests |
| Node map builders | Deterministic Tiled JSON generation and validation |
| Python/Pillow asset tools | Development-time curation and tile processing |

Exact package versions are pinned in `package.json` and `package-lock.json`.

## External references

The dated, categorized source list and the decision taken from each source are in `docs/RESEARCH.md`. The most important primary references were:

- Phaser official releases, migration guide, pixel-art guide and repository skills.
- Tiled JSON map-format documentation.
- Playwright web-server, keyboard and screenshot documentation.
- idb-keyval documentation and IndexedDB lifecycle notes.
- MDN StorageManager persistence documentation.
- Vite static-deployment documentation.

Design references such as classic 2D Zelda, CrossCode, Hyper Light Drifter, Stardew Valley, Moonlighter and Pokémon were used only as high-level interaction principles; no code or art was copied from them.

## Assets

All shipped art, UI, music and sound effects come from the curated Ninja Adventure asset family by Pixel-Boy and AAA under CC0. The raw downloaded pack remains excluded; only files actually used by the game are committed. See `docs/ASSET_LICENSES.md` for source and license evidence.

## Verification record

The final completion gate requires:

1. Strict type checking, unit tests and all generated maps to pass.
2. A production build to succeed.
3. Browser tests to cover boot, input, dialogue, combat, inventory, settings, death/retry, boss, ending, reload and Continue.
4. Production preview to show a visible WebGL canvas with no console errors and no development-only test bridge.

Commands and manual smoke-test steps are listed in `docs/TESTING.md`.
