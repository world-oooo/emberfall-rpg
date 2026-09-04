# Performance

Regenerate every number here with `npm run test:perf`. It writes `artifacts/measurements.md` and prints the
same tables to the console.

## Two very different environments

Playwright launches Chromium with `--use-angle=swiftshader`, so the automated pass rasterises in software.
That is the right choice for determinism in CI but it is not what a player sees. Anything reported below is
labelled with which renderer produced it.

## Hardware WebGL, 1920×1080

Sampled over 240–300 frames per scene on a discrete GPU.

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

## Software WebGL (SwiftShader), 1920×1080

| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Main menu | 17.08 | 27.3 | 33.8 | 37.9 | 5 |
| Village idle | 36.59 | 73.4 | 105.3 | 105.8 | 142 |
| Village walking | 38.30 | 78.0 | 111.8 | 161.0 | 132 |
| Woods idle | 39.30 | 97.4 | 113.8 | 151.0 | 135 |
| Shrine idle | 32.22 | 78.5 | 94.0 | 97.4 | 83 |

Roughly 25–30 fps when a CPU rasterises a 1920×1080 canvas. The menu, which draws almost nothing, stays at
60. This is a fill-rate ceiling in the software rasteriser, not a game-logic cost, and it is the reason the
end-to-end suite uses generous timeouts.

## Map transitions

| Transition | Cold ms | Warm ms |
|---|---|---|
| village to woods | 1505 | 770 |
| woods to village | 482 | - |
| woods to shrine | 1378 | - |
| shrine to woods | - | 396 |

A first visit downloads that map's tilesets, character sheets and music; a return visit is served from cache.
`WorldScene.prefetchNeighbours` warms the browser cache for every map reachable through a door, 500 ms after
the current map is playable.

That prefetch deliberately uses plain `fetch` rather than the Phaser loader. Queuing into the scene loader
raced with map transitions: the scene restarted while files were still in flight, `preload` re-queued the same
keys because the textures did not exist yet, and both copies then tried to register — "Texture key already in
use". Warming the HTTP cache recovers the network time, which dominates, without touching the texture manager.

Music was re-encoded at `-q:a 3` (`tools/assets/curate.py`), taking the audio payload from 16 MB to 6.4 MB.

## Input latency

15 ms from `keydown` to the first change in player position, measured inside the page. That is one frame plus
the input latch.

## Where the time is not going

The audit deliberately did not optimise allocation or HUD update frequency. At 60 fps with p99 under 18 ms on
hardware, there is no measurable pressure to relieve, and every hour spent there is an hour not spent on
presentation. Revisit only if a profile shows a real regression.
