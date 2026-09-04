# Emberfall

Emberfall is a complete, compact browser action RPG built with Phaser 4, TypeScript and Vite. Explore Kagehara Village, cross the Whispering Woods, defeat the corrupted Tanuki Guardian and return the stolen Ember to the village shrine.

## Play

```powershell
npm install
npm run dev
```

Open the address printed by Vite. A typical playthrough takes about 12–20 minutes. Progress is saved automatically in the browser; after refreshing, choose **Continue**.

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
| Pause / back | Escape |

## Adventure route

Speak with Elder Hana and Master Ryo, then follow the south road into the woods. Defeat slimes, find supplies in chests and enter the shrine at the northeast edge. Find the shrine key, break the seal, defeat the Guardian, take the Ember and carry it back to Hana and the unlit village shrine.

## Quality checks

```powershell
npm run check
npm run build
npm run test:e2e
```

See [docs/TESTING.md](docs/TESTING.md) for the acceptance coverage and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the implementation map.

## Design, research and agent references

- [DESIGN.md](DESIGN.md) is the final visual and interaction contract.
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) contains the original vertical-slice design.
- [docs/RESEARCH.md](docs/RESEARCH.md) records the engine, storage, testing, deployment and game-design references used during development.
- [docs/TOOLS_AND_WORKFLOW.md](docs/TOOLS_AND_WORKFLOW.md) records the development tools, agent workflows and repository-local Phaser skills.
- [Claude Fable 5.1용 2D Web RPG 제작 마스터 프롬프트.md](Claude%20Fable%205.1%EC%9A%A9%202D%20Web%20RPG%20%EC%A0%9C%EC%9E%91%20%EB%A7%88%EC%8A%A4%ED%84%B0%20%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8.md) preserves the original project brief.

## Assets and license

Runtime art and audio are curated from the CC0 Ninja Adventure pack. Exact paths, sources and license evidence are listed in [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md). Project code is not automatically placed under that asset license.
