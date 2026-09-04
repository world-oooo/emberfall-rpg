# Testing

Emberfall has four gates: static checks, unit tests, a browser suite, and two scripted capture passes that
produce evidence rather than pass/fail results.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Strict TypeScript, unit tests, generated-map validation |
| `npm run build` | Production bundle; catches missing or misreferenced runtime assets |
| `npm run test:e2e` | Fifteen Playwright tests against the real WebGL canvas |
| `npm run test:perf` | Measurement pass → `artifacts/measurements.md` |
| `npm run test:shots` | Screenshot baseline → `artifacts/playthrough/*.png` |
| `npm run test:matrix` | The whole game, start to Continue, at three viewports in Chromium and WebKit |

`test:perf`, `test:shots` and `test:matrix` have their own configs and are excluded from the default run.
The first two are slow and assert almost nothing; they exist to produce numbers and images you can look at.
The third repeats the long story test six times and takes about five minutes.

## Completion matrix

`npm run test:matrix` plays the game from the main menu to Continue at 1366×768, 1440×900 and 1920×1080, in
Chromium and WebKit. Each run also asserts that the canvas claims the window and that nothing makes the page
itself scrollable. Firefox is not covered because that browser is not installed in this environment.

Two things learned running it: a key press delivered before the game has picked an interaction target is
silently lost, which showed up as engine-specific flakiness rather than as a failure at the press. The shared
`interactAt` and `talkTo` helpers now wait for a target before pressing. And six full playthroughs back to
back put the dev server under enough load that one map load exceeded a 30-second budget on WebKit, so that
config allows a single retry.

## Browser suite

Fifteen tests, all of which fail on any unexpected console error or page error:

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
11. An inventory item heals, and pause settings change volume and display mode.
12. The full Ember quest: both quests, boss, ending, save, reload, Continue.
13. The shrine braziers open the keepers' vault, and the shortcut unbars.
14. The hidden grove chest in the village pays out.
15. No more than two regular enemies are committed to an attack at the same moment.

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

## Manual release smoke test

1. Start New Game and speak with Elder Hana and Master Ryo.
2. Reach the woods, fight a slime, open a chest and use a rice ball.
3. Enter the shrine, light all four braziers, open the vault, collect the key.
4. Pass the seal and defeat the Guardian; open the keepers' passage on the way out.
5. Take the Ember, return to Hana and relight the shrine. Confirm the shrine burns and villagers say something
   new.
6. Refresh the page, choose Continue and confirm the restored-shrine state remains saved.
