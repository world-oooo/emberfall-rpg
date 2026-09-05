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
- **Mystery:** something *took* the ember; the shrine's old guardian, now known in-game as the Mask Keeper, is
  corrupted by whatever did.
- **Dungeon resolution:** defeat the Mask Keeper, recover the ember, carry it back, relight the shrine.
- **Hook for later:** a masked figure was seen leaving the shrine, and the boss drops a broken mask. Sequel
  content: who, and why.

Tone: warm, slightly melancholic, light humor from villagers. Text is short; no lore dumps.

## 3. Core loop

```
explore → read telegraph → fight → loot / XP → talk → quest step → unlock next space → boss → reward → return → save
```

Every screen has a reason to exist (combat, discovery, story, resource, secret, landmark, transition). Empty tiles get compressed.

## 4. Player

- 16×16 hero ("Actor/CharacterAnimated/NinjaGreen"): idle, walk (4 dirs), attack (4 frames × 4 dirs), roll, hit, dead, item-hold.
- 8-direction movement, normalized diagonals, instant start, short stop-slide (~40 ms) for weight.
- **Attack** (J / Z / Space, gamepad A; rebindable): directional katana slash in a three-cut chain of 55/90/95 ms, 50/90/105 ms and 85/115/185 ms (startup/active/recovery), the third cut at 1.45x damage with a longer lunge. Hitbox only during active frames. Presses are buffered for 170 ms, the chain stays open for 460 ms, and the tail of recovery cancels into a roll. Each cut's animation is stretched to the exact length of its state so nothing outlives what is shown.
- **Roll** (K / X / Shift, gamepad B; rebindable): 300 ms dash at 210 px/s, invulnerable for its first 235 ms, 260 ms cooldown, cancels attack recovery. The Fox Charm adds 20% speed and 60 ms of invulnerability. Teaches itself via the Spore Cap.
- **Interact** (E / Enter, gamepad X): NPCs, chests, signs, shrine, doors.
- **Throw shuriken** (L / C, gamepad Y): consumable ranged attack, 3 damage, for the mushroom and bat.
- Stats: HP (hearts, start 6 = 3 hearts), Attack (weapon), Level 1→6 across the slice. Level-up: +1 heart every 2 levels, +1 attack every level.

## 5. Enemies (identity first)

| Enemy | Sprite | Identity | Behaviour |
|---|---|---|---|
| Forest Slime | Monster/Slime | **Chaser** — weak, teaches attack | Idle → hops in pulses toward the player from ~5 tiles → 180 ms wind-up (ground circle) → 150 ms lunge → 820 ms cooldown. 4 HP, 1 dmg. |
| Spore Cap | Monster/Mushroom | **Zoner** — teaches roll and spacing | Keeps its distance, backing off when the player closes → 420 ms wind-up (ring telegraph) → spore burst around itself for 180 ms → 1.35 s cooldown. 5 HP, 1 dmg. |
| Shrine Bat | Monster/BlueBat | **Swooper** — teaches timing | Weaves in on a sine → 120 ms wind-up (charge telegraph) → 170 ms bite → peels away for the first 320 ms of a 760 ms cooldown. 3 HP, 1 dmg. |
| Hollow Guard | Character/Skeleton | **Heavy** — teaches reading big telegraphs | Walks straight in → 280 ms wind-up (squash, ground circle) → steps through a 120 ms swing at 1.7x speed, big knockback → 1.05 s recovery (punish window). 7 HP, 2 dmg. At most two regular enemies may be winding up or swinging at once. |

Four enemies, four different questions asked of the player. Counts stay low; placement does the work.

## 6. Boss — the Mask Keeper (Boss/GiantRacoon)

Arena: shrine inner hall (20×12 tiles, four pillars as cover, the ember pedestal behind). Entering it locks the camera to the room, wakes the Keeper, swaps to the boss track and shows the name plate; leaving the room hands the camera back.

- **Swipe:** inside ~52 px. Squash wind-up with a red ground circle → 150 ms claw hitbox → recovery.
- **Charge:** from 46 px out. Wind-up with a rectangle telegraph along the charge line → rushes at 320 px/s → stops on walls and pillars, stunned with a visible wobble: the main punish window.
- **Spirit Burst:** at range. Ring telegraph → eight spirit orbs in a circle (ten in phase 2); orbs die on walls and after a short life.
- **Phase 2 (≤50% HP):** tint flash and roar; the attack mix shifts, attacks chain into follow-ups and the burst grows. No summons.
- 42 HP, sized for a 90–150 s fight against a player who reads the telegraphs (`artifacts/boss-balance.md` records the measured floor). Drops the Broken Mask (hook); the Ember waits on the pedestal behind it. Quest reward: 120 XP and the Guardian's Charm (+1 heart).

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
| `quest_sleeping_guardian` | The Sleeping Guardian | (auto after previous) | Find the shrine key → defeat the Mask Keeper → take the Ember → return to Hana → relight the shrine | 120 XP, Guardian's Charm, ending scene |
| `quest_lost_charm` (side) | Mimi's Lost Charm | Mimi | Find the charm in the secret grove → return | 30 XP, 15 coins, Life Potion; the Fox Charm (+20% roll speed) stays with the player |

Quest state is data-driven and saved. NPC lines change with quest state.

## 9. Items (meaningful, few)

| ID | Type | Effect |
|---|---|---|
| `katana` | weapon | fast, 2 dmg, reach 14 px, knockback 90 |
| `heavy_blade` | weapon (shop 80c, or free from the keepers' vault) | slow (1.6× timings), 4 dmg, reach 18 px, knockback 180 |
| `shuriken` | consumable, stack 20 | thrown projectile, 3 dmg |
| `rice_ball` | consumable, stack 10 | heals 4 HP (2 hearts) |
| `life_potion` | consumable, stack 5 | full heal |
| `guardian_charm` | accessory | +1 heart |
| `fox_charm` | accessory | +20% roll speed, +60 ms roll invulnerability |
| `shrine_key` | key | opens the sealed shrine door |
| `ember` | quest | relights the shrine |
| `broken_mask` | quest | story hook |
| `coin` | currency | shop |

Equipment slots: weapon, accessory. Two weapons that play differently beat five that don't.

## 10. Progression & economy

- XP from enemies (slime 2, spore 3, bat 3, skeleton 5, boss 40) and quests (40, 120, 30). Level thresholds: 20, 50, 90, 140, 200; +1 heart every second level.
- Coins from chests and drops; the shop sells rice balls (10c), shuriken ×5 (15c), life potion (40c), heavy blade (80c).
- Money exists to buy the heavy blade before the shrine, or potions for the boss. That is the only balancing target.

## 11. Onboarding (teach by play)

1. Village road → movement. 2. Hana → interaction and the quest marker. 3. Master Ryo's dojo dummy → attack. 4. First slime on the forest road → real combat. 5. Spore cap behind the bridge → roll. 6. Visible chest behind trees → exploration pays. No tutorial popups; short contextual hints in the HUD the first time an input matters.

## 12. Difficulty

Readable, avoidable, punishing enough to matter. Enemy contact damage only during their attack windows. Death returns the player to the last save (village shrine / dungeon entrance) with full HP; nothing is lost except position.

## 13. Vertical slice acceptance

Main menu → New Game → village → Hana → dojo → forest → slimes → chest → spore caps → shrine → key → skeletons/bats → Mask Keeper → Ember → return → relight → quest complete → save → refresh → Continue restores everything. No dev commands needed.

## 14. Out of scope (for the slice)

Multiplayer, accounts, backend, crafting, skill trees, day/night, weather, more than two weapons, Korean/other localizations
(text data is already externalized so this can be added later).
