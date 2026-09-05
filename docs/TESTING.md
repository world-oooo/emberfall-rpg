# Testing

Emberfall has five gates: static checks, unit tests, the default browser suite, a production smoke suite, and
scripted evidence passes for screenshots, viewport coverage and frame-time measurements.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Strict TypeScript, unit tests, generated-map validation |
| `npm run build` | Production bundle; catches missing or misreferenced runtime assets |
| `npm run test:e2e` | Twenty-four Playwright tests against the real WebGL canvas |
| `npm run test:production` | Production build plus production-preview smoke test; asserts no development-only test bridge |
| `npm run test:perf` | Measurement pass → `artifacts/measurements.md`, plus a boss fight with real attacks → `artifacts/boss-balance.md` |
| `npm run test:shots` | Screenshot baseline → `artifacts/playthrough/*.png`, including the release-candidate menus at 1366×768 |
| `npm run test:matrix` | The whole game, start to Continue, at three viewports in Chromium, WebKit and Firefox where installed |

`test:production`, `test:perf`, `test:shots` and `test:matrix` have their own configs and are excluded from the default run.
The perf and screenshot passes assert little; they exist to produce numbers and images you can look at. The
matrix pass repeats the long story test across browser/viewport combinations and is intentionally slower.

## Completion matrix

`npm run test:matrix` plays the game from the main menu to Continue at 1366×768, 1440×900 and 1920×1080. The
config includes Chromium, WebKit and Firefox; locally installed browsers determine which projects can run.
Each run also asserts that the canvas claims the window and that nothing makes the page itself scrollable.

Two things learned running it: a key press delivered before the game has picked an interaction target is
silently lost, which showed up as engine-specific flakiness rather than as a failure at the press. The shared
`interactAt` and `talkTo` helpers now wait for a target before pressing. And six full playthroughs back to
back put the dev server under enough load that one map load exceeded a 30-second budget on WebKit, so that
config allows a single retry.

## Browser suite

Twenty-four tests, all of which fail on any unexpected console error or page error. Fifteen cover the game:

1. Boots to a WebGL canvas on the main menu.
2. The canvas fills the browser window.
3. New Game starts in the village with the initial save.
4. Holding a movement key moves the hero.
5. An attack resolves inside its animation and hands control back.
6. The village south gate leads to Whispering Woods with ten enemies.
7. Elder Hana's dialogue starts the main quest.
8. A real melee swing damages a forest slime.
9. A chest yields shuriken and throwing one consumes it and damages an enemy.
10. Death shows the game-over card and revives at the checkpoint.
11. An inventory item heals, and the pause/options menu changes volume and display mode.
12. The full Ember quest: both quests, boss, ending, save, reload, Continue.
13. The shrine braziers open the keepers' vault, and the shortcut unbars.
14. The hidden grove chest in the village pays out.
15. No more than two regular enemies are committed to an attack at the same moment.

Seven cover the release surface (`release.spec.ts`), driving the real menus with the keyboard:

16. Rebinding Attack from the pause Controls screen: a key owned by Roll is refused, U is accepted, U swings and
    J no longer does, and the binding survives a reload.
17. Save & Quit returns to the title with the world stopped, and Continue resumes the same position and coins.
18. Export downloads `emberfall-save.json`; a modified copy imports from the title after confirmation, a broken
    file is refused without touching the slot, and Continue loads the import.
19. The fullscreen toggle leaves the stored preference matching reality and the display sane, whether or not
    the browser granted it.
20. Credits opens from the title and the menu still works afterwards.
21. Mimi's Lost Charm completes through the real quest, chest and reward systems and survives a reload.
22. The ending card's Return to Title saves the restored world; Continue comes back with the shrine lit.

Two cover the gamepad (`gamepad.spec.ts`), driving a synthetic standard-mapping pad injected over
navigator.getGamepads:

23. A gamepad is detected, its D-pad navigates the title menu, A confirms Continue, and the active device
    flips to gamepad.
24. The left stick walks the hero, the Menu button opens pause, the D-pad moves through the rows, and A resumes.

### Slow machines

A GPU-less CI runner renders the game at two or three frames per second, and Phaser clamps each frame's delta
to 200 ms. Input is queued per physical press and consumed one press per frame, so nothing collapses, and the
tests poll while a key is held rather than trusting a fixed hold. `E2E_CPU_THROTTLE=6 npm run test:e2e`
reproduces that runner locally through Chromium's CPU throttle; keep it green before trusting CI.

### Two harness lessons worth keeping

**Traces are expensive here.** With `trace: 'retain-on-failure'`, Playwright captured a snapshot of a
full-window WebGL canvas on every action. Under the software rasteriser that cost seconds per action and
caused timeouts that looked like game bugs. The suite went from 9.7 minutes to 1.2 minutes by recording traces
only on the retry of a failing test.

**Sample inside the page.** A CDP round trip can cost more than the frames being measured. Anything shorter
than a few hundred milliseconds — the 240 ms attack, frame pacing, transition timing — is sampled with a
`requestAnimationFrame` loop inside `page.evaluate`, not by polling from Node.

## Map validation

`npm run maps:validate` checks every generated map for unknown ids, duplicate chest ids, doors pointing at
missing spawns, quest triggers naming objectives their quest does not define, and reachability: a flood fill
from every player spawn must reach every chest, NPC, door, sign and enemy spawn. The fill passes through
`Seal` gate cells, because those are solid in the shipped map but open during play.

## Development test bridge

Development builds expose `window.__GAME_TEST__`, gated by `import.meta.env.DEV` and absent from production.
It offers read-only state getters (player, map, save, enemies, settings, display layout) plus a few
deterministic helpers (`teleport`, `damageEnemy`, `damagePlayer`, `healPlayer`, `saveNow`). The helpers keep
the long story test short; separate tests still exercise real movement, interaction, melee and menu input.

## Release-candidate UI checks

The RC menu surface has three additional areas to keep covered when changing input, saves or title flow:

- **Controls:** title screen and pause menu expose all eleven rebindable keyboard actions. Reserved browser
  keys and keys already owned by another action are rejected, while gamepad prompts remain available.
- **Save data:** save export downloads `emberfall-save.json`; import reads a local JSON file, validates it
  through `SaveSystem.parseImport` before confirmation, and leaves the current save untouched on failure.
- **Title flow:** Continue displays save metadata, New Game warns before replacing an existing save, and
  Save & Quit writes the current session before returning to the title screen.

## Manual release smoke test

1. Start New Game and speak with Elder Hana and Master Ryo.
2. Reach the woods, fight a slime, open a chest and use a rice ball.
3. Enter the shrine, light all four braziers, open the vault, collect the key.
4. Pass the seal and defeat the Mask Keeper; open the keepers' passage on the way out.
5. Take the Ember, return to Hana and relight the shrine. Confirm the shrine burns and villagers say something
   new.
6. Refresh the page, choose Continue and confirm the restored-shrine state remains saved.
