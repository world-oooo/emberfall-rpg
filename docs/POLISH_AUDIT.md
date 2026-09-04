# Emberfall — Polish Audit

Measured on 2026-09-05 against commit `9e373ca` running from the local dev server, Chromium (Playwright),
WebGL renderer. Scores: 1 = broken, 2 = weak, 3 = acceptable, 4 = good, 5 = shippable.

## Overall: 2.9 / 5

The game is feature-complete and technically healthy — 60 fps everywhere, no console errors, every system works.
What holds it back is presentation and combat identity: the canvas uses less than half the screen on common
laptops, the HUD is unstyled text painted over the world, the boss is a re-skinned regular enemy, and the shrine
interior is visually broken.

## Scores

| Area | Score | Evidence |
|---|---|---|
| Visual Presentation | 3 | World tiles read well; interiors and HUD do not |
| Screen Scaling | **1** | 49% window use at 1366×768, 45% at 1440×800 (measured) |
| Pixel Sharpness | 4 | Integer zoom, no shimmer, no bleeding |
| Camera | 3 | Smooth and pixel-snapped, but no look-ahead or arena framing |
| Movement Feel | 4 | Responsive, frame-independent acceleration |
| Attack Feel | **2** | Logic 300/300/440 ms vs 250 ms animation → character freezes after each swing |
| Roll Feel | **2** | Logic 360 ms vs 214 ms animation → visible slide after the animation ends |
| Hit Feedback | 3 | Flash + spark + shake + number present; hitstop implementation is fragile |
| Enemy Readability | **2** | Telegraph is a tint change only; no separation, enemies stack |
| Enemy Variety | 3 | Four archetypes exist but three behave similarly in practice |
| Boss Design | **1** | One attack, chases constantly, 5 of 6 HP lost in 2.8 s while standing still |
| HUD | **1** | Unstyled text over the world; unreadable on grass and shrine floor |
| Dialogue UI | 2 | Grey interior does not match the wood frame; portrait box overlaps text |
| Inventory UI | 2 | Text list, no icons, visible panel seam, most of the panel empty |
| Quest UX | 3 | Objective tracker works; styling matches the weak HUD |
| Main Menu | 3 | Clean, but tiny inside a large black frame |
| Level Design | 3 | Village and woods have real structure |
| Exploration | 3 | Secret grove and chests exist |
| World Density | 2 | Woods trees sit on a visible 2-tile grid; village has large empty grass |
| Secrets | 3 | One secret grove, three chests |
| Audio | 3 | Music and SFX in place; hard cuts between areas; 16 MB of audio |
| Loading | 4 | Village 0.7 s, woods 1.4 s, shrine 1.0 s |
| Performance | **5** | 60 fps, p99 ≤ 17.9 ms in every scene, one 33 ms spike total |
| Save UX | 4 | Autosave and Continue work |
| Accessibility | 3 | Shake toggle, volume, hints; no rebinding |
| Browser Robustness | 4 | No errors, resize handled, keys captured |
| Overall Polish | 2 | Reads as a competent prototype, not a released indie game |

## Measured data

### Viewport matrix (before changes)

| Viewport | Canvas CSS | Scale | Window used |
|---|---|---|---|
| 1280×720 | 960×540 | 2× | 56.3% |
| 1366×768 | 960×540 | 2× | **49.4%** |
| 1440×800 | 960×540 | 2× | **45.0%** |
| 1440×900 | 1440×810 | 3× | 90.0% |
| 1536×864 | 1440×810 | 3× | 87.9% |
| 1600×900 | 1440×810 | 3× | 81.0% |
| 1920×1080 | 1920×1080 | 4× | 100% |
| 2560×1440 | 2400×1350 | 5× | 87.9% |

Cause: a 480×270 canvas needs 810 px of height for 3× zoom. Every window shorter than 810 px falls back to 2×,
which is 960×540 — a quarter of a 1080p screen. The two most common laptop sizes are the worst cases.

### Performance (1920×1080, WebGL)

| Scene | Avg | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Menu | 16.67 ms | 17.1 | 17.4 | 19.3 | 0 |
| Village idle | 16.66 | 17.2 | 17.3 | 17.3 | 0 |
| Village walking | 16.67 | 17.1 | 17.2 | 17.5 | 0 |
| Woods idle | 16.67 | 17.2 | 17.4 | 17.5 | 0 |
| Woods combat | 16.67 | 17.3 | 17.9 | 18.0 | 0 |
| Shrine idle | 16.67 | 17.2 | 17.2 | 17.3 | 0 |
| Boss fight | 16.67 | 17.2 | 17.6 | 33.2 | 1 |

Heap 55.6 MB. Map loads: village 697 ms, woods 1359 ms, shrine 995 ms.

Performance is not a problem. Optimisation work is deliberately deprioritised.

## Biggest problems, in order

1. **Canvas uses half the window on laptops.** The single most damaging first impression.
2. **Boss is a regular enemy with more HP.** It chases without pause and drained 5 of 6 player hearts in
   2.8 seconds of standing contact. No telegraph, no phases, no arena, no punish window.
3. **HUD is developer text.** Level, XP, coins and the quest tracker are drawn straight onto the world.
4. **Attack and roll logic outlast their animations.** The hero visibly freezes after each swing and slides
   after each roll.
5. **Shrine interior is visually broken.** One flat floor tile across 30×40, furniture tiles used as walls,
   scattered black gaps that read as missing tiles.
6. **Enemy telegraphs are a tint change**, and enemies have no separation so they overlap into one blob.
7. **Menus are text lists** without icons or structure.
8. **Woods forest is on a visible 2-tile grid.**

## Comparison references

- **Hyper Light Drifter** — attack and dash resolve inside the animation; input never outlives what you see.
- **CrossCode** — every enemy attack has a distinct wind-up pose and colour before it lands.
- **Eastward** — interiors are built from varied tiles and warm light, never one repeated floor tile.
- **Moonlighter** — HUD sits in framed panels that belong to the art, not floating text.
- **TUNIC** — the boss arena is a separate space with a door, a name and its own music.
- **Death's Door** — bosses telegraph slowly and leave a clear punish window after each attack.
- **Minishoot' Adventures** — the camera shows a consistent amount of world at every window size.

## Direction

Keep the architecture. Change presentation and combat identity.

- Display: fill the window at an integer camera zoom instead of letterboxing a fixed canvas.
- Combat: align logic to animation, add cancel windows, make hitstop a single owned controller.
- Boss: give the Mask Keeper its own controller, three attacks, two phases and an arena sequence.
- UI: framed HUD, icon inventory, structured panels, all laid out responsively.
- World: repair the shrine, break the forest grid, add reasons to look around.

## Implementation order

**P0** — display system, HUD frame, attack/roll timing, hitstop controller, camera look-ahead, boss controller.
**P1** — enemy telegraphs and separation, dialogue/inventory/quest/shop/menu redesign, shrine repair, woods density.
**P2** — audio transitions, region prefetch, allocation cleanup, regression tests, full playthrough.
