# Playtest notes

Notes from driving the finished build end to end, at 1280×720 and 1920×1080, in Chromium.

## Route and pacing

The intended route is Elder Hana → Master Ryo → south gate → Whispering Woods → four slimes → shrine entrance
→ brazier puzzle → key room → sealed stair → Mask Keeper → Ember → back to Hana → relight the village shrine.
A player who explores the optional content runs about 15–20 minutes; a direct run is closer to 12.

## What reads well

- **The first thirty seconds.** The canvas fills the window, the village is dense enough to look inhabited,
  and the objective is legible in the corner without opening a menu.
- **The three-hit combo.** Each swing resolves inside its animation, the third hit is heavier and lunges
  further, and the hitstop on a connect gives the katana weight.
- **The arena.** Walking through the opened seal locks the camera, wakes the Keeper and swaps the music in one
  beat. It reads as an event rather than as another corridor.
- **The ending.** Lighting the village shrine changes the world, not just an overlay: the pedestal burns, the
  hill glows, embers drift, and every villager has a new line.

## Rough edges worth knowing

- **The brazier puzzle is easy to miss.** The sign in the entrance hall is the only hint, and a player who
  runs straight up the stair will never learn the vault exists. That is deliberate for a secret, but it means
  most players will finish without the heavy blade.
- **The shortcut arrives late.** It is barred from the arena side, so its value is one walk back. It pays off
  for a player who dies to the boss and returns, and does very little otherwise.
- **Three regular enemies play alike.** Slime, mushroom and skeleton all close distance and touch you. The
  bat's flight pattern is the only real variation before the boss.
- **The Keeper's charge is the hardest attack to read** at 4× zoom on a small window, because the telegraph
  rectangle can start off screen. It is fair at 5× and above.

## Difficulty

Starting at 6 HP with a 2-damage katana, the woods are forgiving; the shrine's skeletons punish standing
still. The Guardian's Charm from the shrine entrance takes the player to 8 HP before the boss, and the boss
does 2 per hit with a real punish window after each attack. A careful player wins first try; a careless one
dies once and retries from the shrine entrance with the seal and braziers already handled.

## Settings that matter

- **Display mode.** "Fill window" is the default and the better experience. "Fixed view" exists for players
  who want an identical field of view and do not mind letterboxing.
- **Screen shake.** On by default. The boss fight is noticeably calmer with it off, and nothing depends on it.

## Verified end to end

Menu → New Game → Hana → Ryo → woods → four slimes → shrine → braziers → vault → key → seal → arena → Mask
Keeper → Ember → woods → village → Hana → relight → save → reload → Continue, with the restored shrine still
burning and every world flag intact. No console errors at any point.
