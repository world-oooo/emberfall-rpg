# Performance

Regenerate every automated number here with `npm run test:perf`. It writes `artifacts/measurements.md`
(viewport matrix, frame times, transitions, input latency) and `artifacts/boss-balance.md` (a boss fight
driven by real attacks) and prints the same tables to the console.

## Two very different environments

Playwright launches Chromium with `--use-angle=swiftshader`, so the automated pass rasterises in software.
That is the right choice for determinism in CI but it is not what a player sees. Anything reported below is
labelled with which renderer produced it.

## Hardware WebGL, 1920×1080

Sampled over 240–300 frames per scene on a discrete GPU, before the release-candidate title vignette was added.

| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Main menu | 16.63 | 17.1 | 17.2 | 17.3 | 0 |
| Village idle | 16.60 | 17.2 | 17.4 | 17.4 | 0 |
| Village walking | 16.67 | 17.2 | 17.5 | 18.4 | 0 |
| Woods idle | 16.67 | 17.3 | 17.4 | 17.4 | 0 |
| Shrine idle | 16.63 | 17.3 | 17.5 | 17.5 | 0 |
| Boss fight, phase 2 | 16.62 | 17.3 | 17.8 | 18.9 | 0 |

A locked 60 fps in every scene, with no frame over 33 ms anywhere including the boss fight with projectiles,
telegraphs and particles on screen. JS heap peaks around 100 MB.

## Software WebGL (SwiftShader), 1920×1080, release candidate

| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Main menu | 19.38 | 25.8 | 146.2 | 161.3 | 8 |
| Village idle | 17.61 | 23.0 | 25.2 | 37.1 | 1 |
| Village walking | 20.02 | 22.4 | 26.3 | 30.9 | 0 |
| Woods idle | 19.83 | 24.9 | 26.6 | 27.7 | 0 |
| Shrine idle | 18.14 | 21.4 | 23.7 | 35.1 | 2 |

Even the CPU rasteriser now holds close to 60 fps in the world scenes. The main-menu spikes are the title being
rebuilt once the save slot finishes loading, about a hundred milliseconds after the sample starts; steady-state
menu frames sit at 17–26 ms. This has not been re-measured on hardware since the vignette landed.

## Map transitions

| Transition | Cold ms | Warm ms |
|---|---|---|
| village to woods | 1136 | 234 |
| woods to village | 233 | - |
| woods to shrine | 1248 | - |
| shrine to woods | - | 226 |

A first visit downloads that map's tilesets, character sheets and music; a return visit is served from cache.
`WorldScene.prefetchNeighbours` warms the browser cache for every map reachable through a door, 500 ms after
the current map is playable.

That prefetch deliberately uses plain `fetch` rather than the Phaser loader. Queuing into the scene loader
raced with map transitions: the scene restarted while files were still in flight, `preload` re-queued the same
keys because the textures did not exist yet, and both copies then tried to register — "Texture key already in
use". Warming the HTTP cache recovers the network time, which dominates, without touching the texture manager.

Music was re-encoded at `-q:a 3` (`tools/assets/curate.py`), taking the audio payload from 16 MB to 6.4 MB.

## Input latency

44 ms from `keydown` to the first change in player position under the software rasteriser (15 ms in an earlier
pass on a lighter frame). One frame plus the input latch.

## Boss fight, measured with real attacks

`tests/e2e/boss-balance.spec.ts` drives a bot that only closes distance and swings the katana, healed every
250 ms so death never ends the sample. It never rolls, so the number is the floor of the fight's length: a
player who dodges takes longer, one who cannot read the boss dies.

| Boss health | Mash-bot kill time | Hits landed | Times hit |
|---|---|---|---|
| 42 (original) | 4.4 s | 11 | 2 |
| 84, with intro invulnerability, wind-up guard and counter | 9.5 s | 28 | 4 |
| 140, shipped | 21.7 s | 48 | 13 |

Thirteen hits is more than a player's eight health, so trading blows is no longer a strategy; the fight has to
be played through its recovery windows, where one chain of about 7 damage every 3 s puts a careful player at
roughly 80–120 s. Human playtesting remains the final arbiter of that estimate.

## Where the time is not going

The audit deliberately did not optimise allocation or HUD update frequency. At 60 fps with p99 under 18 ms on
hardware, there is no measurable pressure to relieve, and every hour spent there is an hour not spent on
presentation. Revisit only if a profile shows a real regression.
