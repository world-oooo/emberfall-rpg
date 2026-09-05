# Emberfall measurements

Generated 2026-09-05T11:35:33.172Z

## Viewport matrix

| Viewport | Canvas CSS | Zoom | World shown | Window used |
|---|---|---|---|---|
| 1280x720 | 1280x720 | 4x | 320x180 | 100% |
| 1366x768 | 1366x768 | 4x | 341x192 | 100% |
| 1440x800 | 1440x800 | 4x | 360x200 | 100% |
| 1440x900 | 1440x900 | 4x | 360x225 | 100% |
| 1536x864 | 1536x864 | 4x | 384x216 | 100% |
| 1600x900 | 1600x900 | 5x | 320x180 | 100% |
| 1920x1080 | 1920x1080 | 5x | 384x216 | 100% |
| 2560x1440 | 2560x1440 | 7x | 365x205 | 100% |

## Frame time (1920x1080, software WebGL)

| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Main menu | 16.6 | 18.5 | 25.1 | 33.7 | 1 |
| Village idle | 17.28 | 21.2 | 26 | 28 | 0 |
| Village walking | 20.2 | 25.2 | 27.6 | 38.1 | 1 |
| Woods idle | 23.02 | 28.1 | 32.4 | 40.2 | 2 |
| Shrine idle | 19.11 | 23.2 | 25.1 | 38 | 1 |

## Map transitions

| Transition | Cold ms | Warm ms |
|---|---|---|
| village to woods | 1064 | 241 |
| woods to village | 235 | - |
| woods to shrine | 1249 | - |
| shrine to woods | - | 236 |

## Other

- Input latency (keydown to first movement): 37 ms
- JS heap: 61 MB

