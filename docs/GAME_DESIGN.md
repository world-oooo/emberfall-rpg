# Emberfall — Game Design

> Small, complete, top-down action RPG for the browser. One village, one forest, one shrine-dungeon, one guardian.
> 12–20 minutes that feel like a finished game, built so more content slots in without touching the core.

## 1. Concept selection (M0)

Three candidates were compared against: fun, feasibility, asset fit (Ninja Adventure pack), 10–20 min slice,
combat potential, exploration, polish budget, browser suitability.

| Candidate | Summary | Asset fit | Combat | Exploration | Verdict |
|---|---|---|---|---|---|
| **A. Emberfall** (mountain village → forest → shrine) | Apprentice ninja relights the village's sacred ember; a corrupted guardian sleeps in a forest shrine | Excellent: ninja hero, village/house/torii/shrine tiles, forest tiles, interior tiles for the shrine, tanuki boss, forest monsters | Melee + roll + throwable, 4 enemy identities | Village hub, forest with landmarks, secret grove, shrine interior | **Selected** |
| B. Tide & Ruin (fishing village, squid boss) | Coastal village, sea caves, squid boss | Good boss (SquidGreen), but few cave/sea-floor tiles; water-heavy maps are hard to make readable | Ranged-heavy | Water blocks movement, less free exploration | Rejected |
| C. Grave of the Old Samurai (dungeon-first) | Haunted crypt crawl, giant samurai boss | Great boss sheets, weak on overworld/NPC/village variety | Strong | Corridor-heavy, little village life | Rejected (good second dungeon later) |

A wins on onboarding flow (safe village → field → dungeon), landmark variety, NPC purpose, and asset coverage.

## 2. Premise (only what the slice needs)

- **Player goal:** relight the Ember of Kagehara, the village shrine flame.
- **Immediate local problem:** the ember went dark three nights ago; forest creatures turned hostile and the road to the shrine is cut off.
- **Mystery:** something *took* the ember; the Tanuki Guardian that protected the shrine is now corrupted by whatever did.
- **Dungeon resolution:** defeat the Guardian, recover the ember, carry it back, relight the shrine.
- **Hook for later:** a masked figure was seen leaving the shrine (the Guardian drops a broken mask). Sequel content: who, and why.

Tone: warm, slightly melancholic, light humor from villagers. Text is short; no lore dumps.

## 3. Core loop

```
explore → read telegraph → fight → loot / XP → talk → quest step → unlock next space → boss → reward → return → save
```

Every screen has a reason to exist (combat, discovery, story, resource, secret, landmark, transition). Empty tiles get compressed.

## 4. Player

- 16×16 hero ("Actor/CharacterAnimated/NinjaGreen"): idle, walk (4 dirs), attack (4 frames × 4 dirs), roll, hit, dead, item-hold.
- 8-direction movement, normalized diagonals, instant start, short stop-slide (~40 ms) for weight.
- **Attack** (J / Z / Space, gamepad A): directional katana slash. Startup 80 ms → active 120 ms → recovery 160 ms. Hitbox only during active frames. Slash VFX from the pack. Buffered input: pressing attack during recovery queues the next swing (up to a 3-hit chain with the third hit heavier).
- **Roll** (K / X / Shift, gamepad B): 220 ms dash, invulnerable frames 40–180 ms, 350 ms cooldown, cancels attack recovery. Teaches itself via the mushroom spore.
- **Interact** (E / Enter, gamepad X): NPCs, chests, signs, shrine, doors.
- **Throw shuriken** (L / C, gamepad Y): consumable ranged attack, 3 damage, for the mushroom and bat.
- Stats: HP (hearts, start 6 = 3 hearts), Attack (weapon), Level 1→6 across the slice. Level-up: +1 heart every 2 levels, +1 attack every level.

## 5. Enemies (identity first)

| Enemy | Sprite | Identity | Behaviour |
|---|---|---|---|
| Forest Slime | Monster/Slime | **Chaser** — weak, teaches attack | Idle → chase when within 6 tiles → hop-lunge (telegraph: squash 300 ms) → recover 500 ms. 3 HP, 1 dmg. |
| Spore Cap | Monster/Mushroom | **Ambusher / ranged** — teaches roll and spacing | Sits still (looks like scenery) → when within 5 tiles: wake (telegraph 400 ms, shake) → spits 3 spores in a spread every 1.6 s, keeps distance. 4 HP, 1 dmg. |
| Cave Bat | Monster/BlueBat | **Erratic swooper** — teaches timing | Hovers out of reach → telegraph (hover flash 350 ms) → dive through the player position → retreat 1.2 s. 2 HP, 1 dmg. |
| Shrine Skeleton | Character/Skeleton | **Heavy** — teaches reading big telegraphs | Slow walk → when within 2 tiles: wind-up 600 ms (raises blade, red flash) → wide swing, big knockback → long recovery 900 ms (punish window). 8 HP, 2 dmg. |

Four enemies, four different questions asked of the player. Counts stay low; placement does the work.

## 6. Boss — the Tanuki Guardian (Boss/GiantRacoon)

Arena: shrine inner hall (14×10 tiles, pillars as cover). Intro: camera pan + name plate + "Fight" music.

- **Pattern A — Leap Slam:** telegraph (crouch 500 ms, shadow grows) → jumps to the player's position → lands with a ring shockwave (roll through it). Recovery 900 ms.
- **Pattern B — Charge Claw:** telegraph (Charge sheet, 700 ms, ground dust) → rushes in a straight line → stops at walls (stunned 1.2 s if it hits a pillar).
- **Pattern C (phase 2, ≤50% HP):** summons 2 slimes, patterns speed up 20%, adds a double leap.
- 60 HP. Drops the Ember (quest item) and the Broken Mask (hook). Reward: level-up, "Guardian's Charm" (+1 heart).

## 7. World

| Map | Purpose | Landmarks | Content |
|---|---|---|---|
| **Kagehara Village** (40×30) | Hub, safety, onboarding | Unlit shrine on a hill, dojo, torii gate to the forest, well square | Elder Hana (quest), Merchant Botan (shop), Master Ryo (combat hints), child Mimi (side quest), gate guard Goro (soft gate/hints), shrine sign |
| **Whispering Woods** (60×40) | Exploration, first combat, secret | Giant hollow tree, stone bridge over a stream, waterfall, ruined torii | Slimes, spore caps, 3 chests, secret grove (Mimi's charm), hermit's hut, shrine entrance |
| **Hollow Shrine** (30×40, interior) | Dungeon, pressure, boss | Broken statues, pillared hall, sealed door with key | Bats, skeletons, key chest, boss arena, ember pedestal |

Transitions are doors/edges defined in map data; the world scene swaps map data rather than scenes.

## 8. Quests

| ID | Title | Giver | Objectives | Reward |
|---|---|---|---|---|
| `quest_dimmed_shrine` | The Dimmed Shrine | Elder Hana | Talk to Master Ryo → reach the Woods → defeat 4 slimes → reach the shrine entrance | 40 XP, 30 coins |
| `quest_sleeping_guardian` | The Sleeping Guardian | (auto after previous) | Find the shrine key → defeat the Guardian → take the Ember → return to Hana → relight the shrine | 120 XP, Guardian's Charm, ending scene |
| `quest_lost_charm` (side) | Mimi's Lost Charm | Mimi | Find the charm in the secret grove → return | 30 XP, Fox Charm (+10% roll speed) |

Quest state is data-driven and saved. NPC lines change with quest state.

## 9. Items (meaningful, few)

| ID | Type | Effect |
|---|---|---|
| `katana` | weapon | fast, 2 dmg, reach 14 px, knockback 90 |
| `heavy_blade` | weapon (shop 120c) | slow (1.6× timings), 4 dmg, reach 18 px, knockback 180 |
| `shuriken` | consumable, stack 20 | thrown projectile, 3 dmg |
| `rice_ball` | consumable, stack 10 | heal 2 HP |
| `life_potion` | consumable, stack 5 | heal 6 HP |
| `guardian_charm` | accessory | +1 heart |
| `fox_charm` | accessory | roll faster + longer i-frames |
| `shrine_key` | key | opens the sealed shrine door |
| `ember` | quest | relights the shrine |
| `broken_mask` | quest | story hook |
| `coin` | currency | shop |

Equipment slots: weapon, accessory. Two weapons that play differently beat five that don't.

## 10. Progression & economy

- XP from enemies (slime 5, spore 8, bat 6, skeleton 15, boss 100). Level thresholds: 20, 50, 90, 140, 200.
- Coins from chests and drops; the shop sells rice balls (10c), shuriken ×5 (15c), life potion (40c), heavy blade (120c).
- Money exists to buy the heavy blade before the shrine, or potions for the boss. That is the only balancing target.

## 11. Onboarding (teach by play)

1. Village road → movement. 2. Hana → interaction and the quest marker. 3. Master Ryo's dojo dummy → attack. 4. First slime on the forest road → real combat. 5. Spore cap behind the bridge → roll. 6. Visible chest behind trees → exploration pays. No tutorial popups; short contextual hints in the HUD the first time an input matters.

## 12. Difficulty

Readable, avoidable, punishing enough to matter. Enemy contact damage only during their attack windows. Death returns the player to the last save (village shrine / dungeon entrance) with full HP; nothing is lost except position.

## 13. Vertical slice acceptance

Main menu → New Game → village → Hana → dojo → forest → slimes → chest → spore caps → shrine → key → skeletons/bats → Guardian → Ember → return → relight → quest complete → save → refresh → Continue restores everything. No dev commands needed.

## 14. Out of scope (for the slice)

Multiplayer, accounts, backend, crafting, skill trees, day/night, weather, more than two weapons, Korean/other localizations
(text data is already externalized so this can be added later).
