# Emberfall

Emberfall is a compact browser action RPG built with Phaser 4, TypeScript and Vite. The current target is
`1.0.0-rc.1`: explore Kagehara Village, cross the Whispering Woods, defeat the corrupted Mask Keeper and
return the stolen Ember to the village shrine.

## Play

```powershell
npm install
npm run dev
```

Open the address printed by Vite. A first playthrough takes about 15–25 minutes. Progress is saved
automatically in the browser; after refreshing, choose **Continue**. The pause menu also has **Save & Quit**,
and the title/options save menu can export or import a validated JSON save file.

The canvas fills the browser window at an integer camera zoom, so pixels stay exact at any size. The pause
menu can switch to a fixed 400×225 view if you prefer an identical field of view on every machine.

## Controls

| Action | Keys |
| --- | --- |
| Move / navigate menus | Arrow keys or WASD |
| Katana attack | J, Z or Space |
| Roll | K, X or Shift |
| Throw shuriken | L or C |
| Interact / confirm | E or Enter |
| Inventory | I or Tab |
| Quest log | Q |
| Pause / back | Escape or P |

Open **Controls** from the title screen or pause menu to rebind the eleven keyboard actions: four directions,
attack, roll, interact, throw, inventory, quest log and pause. Keyboard prompts update from the active binding;
gamepad prompts switch in when a controller is used.

## Adventure route

Speak with Elder Hana and Master Ryo, then follow the south road into the woods. Defeat slimes, find supplies
in chests and enter the shrine at the northeast edge. Find the shrine key, break the seal, defeat the Mask
Keeper, take the Ember and carry it back to Hana and the unlit village shrine.

Worth looking for on the way: a hidden grove behind the dojo, four cold braziers in the shrine that open a
sealed vault, and a barred passage in the boss arena that drops straight back to the entrance.

## Quality checks

```powershell
npm run check
npm run build
npm run test:e2e
npm run test:production
```

Three further passes run on demand: `npm run test:perf` writes frame-time, viewport and transition
measurements to `artifacts/measurements.md`, `npm run test:shots` regenerates the screenshot baseline in
`artifacts/playthrough/`, and `npm run test:matrix` plays the game start to finish at three viewports in
Chromium, WebKit and Firefox where the browsers are installed.

See [docs/TESTING.md](docs/TESTING.md) for the acceptance coverage,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the implementation map,
[docs/POLISH_AUDIT.md](docs/POLISH_AUDIT.md) for the before/after audit,
[docs/SCREEN_SCALING.md](docs/SCREEN_SCALING.md) for the display system and
[docs/PERFORMANCE.md](docs/PERFORMANCE.md) for measured frame times.

## Design, research and agent references

- [DESIGN.md](DESIGN.md) is the final visual and interaction contract.
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) contains the original vertical-slice design.
- [docs/RESEARCH.md](docs/RESEARCH.md) records the engine, storage, testing, deployment and game-design references used during development.
- [docs/TOOLS_AND_WORKFLOW.md](docs/TOOLS_AND_WORKFLOW.md) records the development tools, agent workflows and repository-local Phaser skills.
- [Claude Fable 5.1용 2D Web RPG 제작 마스터 프롬프트.md](Claude%20Fable%205.1%EC%9A%A9%202D%20Web%20RPG%20%EC%A0%9C%EC%9E%91%20%EB%A7%88%EC%8A%A4%ED%84%B0%20%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8.md) preserves the original project brief.

## Browser support

Verified in Chromium, WebKit and Firefox through the completion matrix, and in a production `vite preview`
build through the production smoke. Desktop browsers only; touch play is out of scope for v1.0. The game is a
static Vite build with no backend, so any static host serves it.

## Credits

- Game: world-oooo, built with Phaser 4, TypeScript and Vite.
- Art, UI, audio and fonts: Ninja Adventure asset pack by Pixel-Boy and AAA, CC0 1.0.
- The in-game Credits screen (title → Credits) carries the same attribution.

## Assets and license

Runtime art and audio are curated from the CC0 Ninja Adventure pack. Exact paths, sources and license evidence are listed in [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md). Project code is not automatically placed under that asset license.
