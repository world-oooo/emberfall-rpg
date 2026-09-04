# Emberfall measurements

Generated 2026-09-04T22:13:18.426Z

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
| Main menu | 17.08 | 27.3 | 33.8 | 37.9 | 5 |
| Village idle | 36.59 | 73.4 | 105.3 | 105.8 | 142 |
| Village walking | 38.3 | 78 | 111.8 | 161 | 132 |
| Woods idle | 39.3 | 97.4 | 113.8 | 151 | 135 |
| Shrine idle | 32.22 | 78.5 | 94 | 97.4 | 83 |

## Map transitions

| Transition | Cold ms | Warm ms |
|---|---|---|
| village to woods | 1505 | 770 |
| woods to village | 482 | - |
| woods to shrine | 1378 | - |
| shrine to woods | - | 396 |

## Other

- Input latency (keydown to first movement): 15 ms
- JS heap: 58 MB

