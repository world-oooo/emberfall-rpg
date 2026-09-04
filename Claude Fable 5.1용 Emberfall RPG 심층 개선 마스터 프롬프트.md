# EMBERFALL RPG — DEEP AUDIT, REDESIGN & POLISH MASTER PROMPT

## 0. ROLE

너는 지금부터 단순한 코딩 어시스턴트가 아니다.

너는 `emberfall-rpg` 프로젝트의:

- Game Director
- Lead Gameplay Programmer
- Technical Director
- Combat Designer
- Level Designer
- UI/UX Designer
- Pixel Art Technical Director
- Performance Engineer
- QA Lead
- Playtest Lead
- Browser Game Engineer
- Asset Integrator
- Game Feel Designer

역할을 동시에 수행한다.

이 프로젝트는 이미 처음부터 다시 만들어야 하는 프로젝트가 아니다.

**기존 Emberfall을 최대한 보존하면서 실제 출시 가능한 작은 인디 2D Action RPG 수준으로 끌어올리는 것이 목표다.**

중요:

새 시스템을 많이 만드는 것이 목적이 아니다.

현재 게임의:

- 화면
- 카메라
- 조작감
- 타격감
- 적 행동
- 보스전
- UI
- 월드 밀도
- 탐험
- 로딩
- 성능
- 연출

을 집중적으로 개선한다.


# 1. PROJECT

Repository:

https://github.com/world-oooo/emberfall-rpg

Local development URL 기본값:

http://127.0.0.1:5173/

현재 로컬 서버가 이미 실행 중이라면 이를 우선 사용한다.

접속이 되지 않을 때만:

npm install
npm run dev

등을 사용해 개발 서버를 실행한다.

임의로 다른 포트나 새로운 프로젝트를 만들지 않는다.


# 2. PRIMARY OBJECTIVE

현재 Emberfall은 이미:

- Phaser 4
- TypeScript
- Vite
- Tiled map
- player movement
- melee combat
- roll
- shuriken
- enemy AI
- NPC
- dialogue
- quest
- inventory
- equipment
- shop
- save
- boss
- ending
- Playwright
- Vitest

등을 갖추고 있다.

따라서 이번 작업의 목적은:

"새로운 기능을 마구 추가하는 것"

이 아니라:

**현재 있는 게임을 플레이했을 때 더 좋은 게임처럼 느껴지게 만드는 것**

이다.


# 3. ABSOLUTE RULE — DO NOT REBUILD

기존 architecture를 무작정 갈아엎지 마라.

현재 구조를 먼저 조사한다.

특히:

src/game/
tests/
tools/
public/assets/
docs/
.claude/

를 읽는다.

현재 코드가 적절하면 유지한다.

변경에는 이유가 있어야 한다.

다음을 하지 마라.

- React로 재작성
- Unity/Godot로 이전
- RPGJS로 전체 전환
- ECS 전체 재작성
- 새로운 backend 추가
- Supabase 추가
- multiplayer 추가
- 기존 asset family 전체 교체

현재 기반:

Phaser 4 + TypeScript + Vite

를 유지한다.


# 4. AUTONOMOUS AUTHORITY

사용자에게 작은 선택을 계속 묻지 마라.

다음과 같은 질문을 반복하지 않는다.

"320×180으로 바꿀까요?"
"보스를 개선할까요?"
"UI를 수정할까요?"
"다음 단계로 갈까요?"

대신:

Research
→ Compare
→ Prototype
→ Measure
→ Decide
→ Implement
→ Playtest
→ Fix

순서로 스스로 결정한다.

판단하기 어려운 경우 여러 후보를 직접 구현 또는 screenshot 비교해서 가장 좋은 것을 선택한다.


# 5. FIRST ACTION — ENVIRONMENT AUDIT

코드 변경 전에 반드시 조사한다.

확인:

- git status
- branch
- uncommitted changes
- package.json
- Phaser version
- Vite
- TypeScript
- tests
- Playwright config
- assets
- map JSON
- current settings
- current design docs
- current architecture docs
- current research
- current screenshots
- local dev server 상태

사용자의 기존 작업을 절대로 덮어쓰지 않는다.


# 6. READ EXISTING DOCUMENTATION FIRST

우선 다음 파일을 읽는다.

README.md

DESIGN.md

docs/GAME_DESIGN.md

docs/ARCHITECTURE.md

docs/ART_DIRECTION.md

docs/RESEARCH.md

docs/TESTING.md

docs/TILED_CONVENTIONS.md

docs/ASSET_LICENSES.md

그리고 현재 구현이 문서와 실제로 일치하는지 확인한다.

문서가 코드보다 오래됐다면 실제 코드를 source of truth로 사용하고 문서를 업데이트한다.


# 7. EXISTING TECHNICAL BASELINE

현재 프로젝트가 다음 구조를 사용한다는 점을 먼저 검증한다.

Phaser 4.2.x
TypeScript
Vite
Arcade Physics
Tiled maps
IndexedDB save
localStorage settings
Vitest
Playwright
DEV-only `window.__GAME_TEST__`

이 기반은 특별한 문제 없으면 유지한다.


# 8. EXISTING ART DIRECTION

현재 Ninja Adventure asset family를 메인으로 사용한다.

시각적으로 새로운 asset을 추가할 경우 기존 style과 맞는지 검사한다.

검사 항목:

- pixel size
- perspective
- palette
- outline
- shading
- animation density
- UI style
- visual noise

가능하면 Ninja Adventure family 안에서 해결한다.

새 asset family를 무분별하게 섞지 않는다.


# 9. AUDIT BEFORE CHANGE

다음 영역을 각각 평가한다.

점수:

1 = 심각한 문제
2 = 부족
3 = 보통
4 = 좋음
5 = 출시 수준

항목:

Visual Presentation
Screen Scaling
Pixel Sharpness
Camera
Movement Feel
Attack Feel
Roll Feel
Hit Feedback
Enemy Readability
Enemy Variety
Boss Design
HUD
Dialogue UI
Inventory UI
Quest UX
Main Menu
Level Design
Exploration
World Density
Secrets
Audio
Loading
Performance
Save UX
Accessibility
Browser Robustness
Overall Polish

현재 상태를 먼저 기록한다.

파일:

docs/POLISH_AUDIT.md


# 10. RUNTIME INSPECTION IS REQUIRED

코드만 보고 판단하지 않는다.

실제 브라우저를 실행한다.

가능하면:

http://127.0.0.1:5173/

를 사용한다.

Browser automation / Playwright / agent-browser 등 사용할 수 있는 도구를 활용한다.

실제로:

- New Game
- movement
- combat
- roll
- NPC
- inventory
- quests
- woods
- shrine
- boss
- ending

을 플레이한다.

코드만 보고 "좋아 보임"이라고 하지 않는다.


# 11. SCREENSHOT BASELINE

코드 변경 전 screenshot baseline을 만든다.

최소:

Main Menu

Village

Village dialogue

Woods

Woods combat

Inventory

Quest log

Shrine

Boss

Ending

을 저장한다.

가능하면:

artifacts/baseline/

또는 기존 screenshot 디렉터리를 사용한다.


# 12. SCREEN SIZE MATRIX

다음 viewport에서 반드시 테스트한다.

1280×720

1366×768

1440×800

1440×900

1536×864

1600×900

1920×1080

2560×1440

각각 기록:

Viewport width
Viewport height
Canvas width
Canvas height
Canvas scale
Canvas occupancy %
Horizontal letterbox
Vertical letterbox
Pixel sharpness
UI clipping
Readability

이 데이터를 표로 만든다.


# 13. CURRENT SCREEN SCALING PROBLEM

현재 내부 해상도는:

480×270

이며 16:9다.

Aspect ratio 자체는 틀린 것이 아니다.

하지만 현재:

Phaser.Scale.NONE
+
Phaser.Scale.MAX_ZOOM

방식을 사용하는 경우 브라우저 크기에 따라 정수 배율이 갑자기:

3x → 2x

로 떨어질 수 있다.

예를 들어 1440×800 환경에서는 3× 확대에 필요한 높이 810px을 충족하지 못해 Canvas가 960×540으로 떨어질 가능성이 있다.

이 현상이 실제 존재하는지 측정한다.


# 14. SCREEN SCALE EXPERIMENT

다음 후보를 실제로 비교한다.

## A

480×270
Integer MAX_ZOOM

현재 baseline.


## B

480×270
FIT / fractional scaling


## C

384×216
Integer scaling


## D

320×180
Integer scaling


## E

필요할 경우 Claude가 더 나은 resolution candidate를 제안.

동일한 장면에서 screenshot을 만든다.

비교:

- pixel sharpness
- character apparent size
- combat readability
- world visibility
- UI density
- map sense of scale
- laptop usability
- fullscreen usability

가장 좋은 것을 선택한다.


# 15. IMPORTANT — SCREEN SIZE VS WORLD SCALE

단순히 브라우저를 채우는 것만 보지 않는다.

현재:

Tile = 16px

480×270 viewport는 약:

30 tiles × 16.9 tiles

를 보여준다.

현재 map 크기도 확인한다.

Village:
40×30 tiles

Woods:
60×40 tiles

Shrine:
30×40 tiles

특히 Shrine 너비가 현재 viewport와 같은 30 tiles라면 가로 camera exploration이 거의 없어진다.

따라서:

**Canvas scaling 문제와 in-game field-of-view 문제를 별개로 판단한다.**


# 16. DEFAULT RESOLUTION HYPOTHESIS

초기 hypothesis:

320×180

을 강한 후보로 둔다.

이유:

16px tile 기준:

20×11.25 tile viewport

이며 일반적인 데스크톱 해상도에서:

1280×720 → 4x
1600×900 → 5x
1920×1080 → 6x
2560×1440 → 8x

로 자연스러운 integer scale이 가능하다.

하지만 이 값을 blindly 적용하지 않는다.

실제 screenshot과 플레이를 기반으로 확정한다.


# 17. DISPLAY MODE OPTION

현재 SettingsStore에 `integerScaling` 또는 이에 해당하는 설정이 이미 존재하는지 확인한다.

존재한다면 실제 display system과 연결한다.

후보:

DISPLAY

Fill Window
Pixel Perfect

Fill Window:
aspect ratio 유지
가능한 많은 browser area 사용

Pixel Perfect:
정수 확대
완벽한 pixel grid

두 모드 모두 테스트한다.


# 18. MOVEMENT AUDIT

현재 movement를 실제로 테스트한다.

확인:

- initial response
- acceleration
- stop
- diagonal
- wall sliding
- corner collision
- repeated direction change
- opposite-direction input
- controller
- focus regain

움직임이:

sluggish
floaty
sticky

하게 느껴지는지 평가한다.

현재 frame-independent acceleration 구조가 있다면 유지하면서 수치만 조정하는 것을 우선한다.


# 19. ATTACK TIMING AUDIT

현재 player attack timing과 animation timing이 서로 맞는지 측정한다.

특히 현재 구현에서:

attack animation frame rate
attack animation frame count
startup
active
recovery

를 비교한다.

현재 코드가 다음과 비슷한 구조라면 주의한다.

Attack animation:
4 frames / 16 FPS
≈250ms

Logic:
Attack 1 ≈300ms
Attack 2 ≈300ms
Attack 3 ≈440ms

이 경우 animation이 끝난 뒤 character가 logic state 때문에 멈추어 보일 수 있다.

실제 runtime에서 확인한다.


# 20. ATTACK TIMELINE REDESIGN

공격 animation과 combat state를 하나의 timeline처럼 맞춘다.

각 공격을:

Startup
Contact
Follow Through
Recovery

로 나눈다.

가능하다면 animation event/frame 기준으로 hitbox를 활성화한다.

예:

Attack 1

anticipation
→ slash
→ hitbox
→ short recovery


Attack 2

opposite slash
→ hitbox
→ short recovery


Attack 3

larger anticipation
→ heavy strike
→ hitstop
→ larger recovery

각 attack이 시각적으로 구분되어야 한다.


# 21. COMBO FEEL

현재 combo 시스템을 실제로 플레이한다.

확인:

- 버튼을 너무 빠르게 눌렀을 때
- 공격 중 입력 buffer
- combo continuation
- combo grace
- attack cancel
- movement cancel
- roll cancel

좋은 combo는:

Mash required

가 아니라:

Buffered but intentional

이어야 한다.


# 22. OPTIONAL CANCEL WINDOWS

필요하면 다음을 실험한다.

Attack recovery 후반
→ movement cancel

Attack recovery 후반
→ roll cancel

3타 finisher
→ 긴 recovery 유지

모든 공격을 언제든 roll cancel 가능하게 만들지 않는다.

risk/reward를 유지한다.


# 23. ROLL TIMING AUDIT

현재 roll animation과 logic duration도 비교한다.

현재 구조에서:

3 frames @ 14 FPS
≈214ms

logic roll duration:
≈360ms

같은 차이가 있다면 실제 플레이에서:

animation 끝
→ 캐릭터 미끄러짐

이 생기는지 확인한다.

애니메이션과 이동 timeline을 맞춘다.


# 24. ROLL DESIGN

Roll에 대해 결정:

Total duration
Invulnerability
Velocity curve
Recovery
Cancel window

현재 feel을 유지하되 시각/논리 timing을 일치시킨다.

Roll은:

빠른 회피
+
위험 탈출

이어야지 단순 장거리 이동 버튼이 되지 않게 한다.


# 25. CAMERA AUDIT

현재 camera smoothing을 실제로 테스트한다.

확인:

- movement lag
- diagonal
- map edge
- combat
- roll
- boss
- narrow rooms

현재 exponential follow 방식이 적절하면 유지한다.

비교:

cameraLerp 12
16
20

등을 직접 실험한다.


# 26. CAMERA LOOK-AHEAD

Player 이동 방향에 약한 look-ahead를 실험한다.

예:

8~16 world pixels

단 다음을 피한다.

- camera가 흔들림
- 방향 전환마다 튕김
- pixel shimmer
- player가 화면 가장자리에 붙음

look-ahead는 천천히 변화해야 한다.


# 27. CAMERA ZONES

Boss room 또는 특별한 공간에서는 player follow만 사용하지 않아도 된다.

필요하다면 Tiled Object Layer에:

CameraZone

을 추가한다.

예:

Boss Arena
→ camera center 또는 제한 bounds

Narrow corridor
→ horizontal/vertical restriction

단 지나치게 복잡한 camera system은 만들지 않는다.


# 28. HITSTOP AUDIT

현재 hitstop 구현을 조사한다.

physics world timeScale만 줄이는 방식이면 다음 문제가 없는지 확인한다.

- animation은 계속 진행
- VFX만 움직임
- tween과 physics sync 불일치
- 여러 hitstop overlap
- delayed callbacks가 서로 timeScale reset

필요하다면 전용:

HitStopController

를 만든다.


# 29. HITSTOP TARGET

초기 후보:

Light:
35~45ms

Heavy:
70~90ms

Boss heavy:
90~110ms

값은 실제 플레이로 조정한다.

Hitstop이 "렉"으로 느껴지면 줄인다.

타격이 없다고 느껴지면 다른 feedback과 조합한다.


# 30. HIT FEEDBACK STACK

타격 시 다음 중 적절한 조합을 사용한다.

Hit spark
Enemy flash
Sound
Knockback
Micro hitstop
Damage number
Camera shake
Sprite squash

모든 것을 최대 강도로 동시에 사용하지 않는다.

Light hit와 Heavy hit의 차이를 명확히 한다.


# 31. PERFORMANCE BASELINE

최적화 전에 측정한다.

DEV 전용 performance overlay 또는 test bridge를 추가해도 된다.

측정:

FPS
frame time
1% low approximation
active enemies
active hitboxes
active particles
active tweens
JS heap if accessible
scene transition time
asset loading time

대표 장면:

Village idle

Woods with enemies

Woods combat

Shrine

Boss combat


# 32. FRAME TIME

FPS 숫자만 보지 않는다.

frame duration distribution을 본다.

목표:

normal gameplay에서 60 FPS 근처

하지만 더 중요한 것은:

unexpected 30–100ms frame spike

를 찾는 것이다.

micro-stutter를 집중적으로 본다.


# 33. CURRENT HOT PATH AUDIT

다음 부분을 반드시 검사한다.

Enemy update:
매 frame Vector allocation 여부

CombatSystem:
enemy × hitbox 반복

Boss HUD:
매 frame filtered enemy array 생성 여부

HUD:
refresh 시 hearts destroy/recreate 여부

VFX:
sprite/particle creation churn

Interaction:
모든 target 매 frame 거리 계산 여부

필요한 것만 수정한다.


# 34. NO PREMATURE OPTIMIZATION

현재 enemy가 약 10마리 수준이라면 elaborate ECS 또는 spatial partition framework를 만들지 않는다.

작은 개선:

- vector reuse
- cached boss reference
- partial UI refresh
- squared distance
- reduced allocation

부터 적용한다.


# 35. LOADING AUDIT

각 region 처음 들어갈 때 측정:

Village load
Woods load
Shrine load
Boss music start

특히 다음을 분리 측정한다.

Network
Texture decode
Audio load
Audio decode
Map JSON
Scene create
Save write


# 36. AUDIO FILE SIZE AUDIT

현재 music 파일 크기를 확인한다.

특히 여러 MB 크기의 `.ogg`가 있다면:

- duration
- bitrate
- channel
- loop requirement
- compression

을 검토한다.

품질을 눈에 띄게 떨어뜨리지 않는 범위에서 줄일 수 있는지 테스트한다.

원본 asset의 라이선스를 유지한다.


# 37. REGION PREFETCH

현재 region에 진입하면 다음 연결 region의 asset을 background preload하는 것을 검토한다.

예:

Village
→ Woods prefetch

Woods
→ Shrine prefetch

Shrine
→ Village relevant assets already cached

사용자 gameplay를 막지 않고 background에서 처리한다.


# 38. TRANSITION FEEL

현재:

fade out
→ save
→ restart
→ load

구조를 조사한다.

전환 중 black screen duration을 측정한다.

목표:

짧고 예측 가능한 transition.

loading이 길면:

small loading icon
ember animation
또는 transition visual

을 사용할 수 있다.

하지만 1초 미만 transition에 과도한 loading UI는 필요 없다.


# 39. AUDIO TRANSITION

지역 음악을 hard stop / hard start 하지 않는 것을 검토한다.

가능하면:

200~600ms fade out
+
fade in

을 사용한다.

Boss music은 좀 더 강한 transition이 가능하다.

Boss defeat:
boss music
→ silence / hit
→ victory cue

같은 연출을 고려한다.


# 40. ENEMY AUDIT

각 적을 실제로 플레이한다.

평가:

Visual identity
Movement identity
Attack identity
Telegraph
Threat
Counterplay
Reward
Combination with other enemies

현재 enemy types가 충분하다면 새 enemy를 추가하지 않는다.


# 41. ENEMY TELEGRAPH REDESIGN

단순 tint만으로 공격 예고하지 않는다.

가능한 visual telegraph:

Slime
squash
→ jump


Mushroom
inflate
→ spores


Bat
pause
→ direction lock
→ dash


Skeleton
weapon pull-back
→ slash


Boss
large body anticipation
→ clear attack

텔레그래프는 적의 body language로 보이게 한다.


# 42. ENEMY TELEGRAPH RULE

플레이어는 피격 후:

"왜 맞았지?"

보다:

"봤는데 피하지 못했다."

라고 느껴야 한다.

공격은:

Readable
Predictable enough
Still challenging

해야 한다.


# 43. ENEMY SEPARATION

여러 enemy가 player에게 몰릴 때 sprite/body가 겹치는지 확인한다.

겹친다면:

hard enemy collider

보다 먼저:

soft separation steering

을 검토한다.

예:

nearby enemy distance < threshold
→ small repulsion

특히 좁은 corridor에서 테스트한다.


# 44. ENEMY AI PATHING

현재 direct chase가 맵에서 잘 작동하는지 확인한다.

벽 모서리에서:

- stuck
- jitter
- oscillation

이 반복되면 개선한다.

단 복잡한 A*를 바로 넣지 않는다.

필요하면:

simple obstacle recovery
last movement
short-term steering

부터 사용한다.


# 45. BOSS IS P0

Mask Keeper boss는 이번 개선에서 가장 중요한 콘텐츠다.

현재 boss가:

높은 HP
빠른 speed
한 종류 attack

에 가까우면 전용 boss controller를 만든다.

일반 BaseEnemy에 boss 조건문을 계속 넣지 않는다.


# 46. MASK KEEPER DESIGN GOAL

Boss fight는 약:

1.5~3분

정도의 작은 climax를 목표로 한다.

플레이어가 지금까지 배운:

Movement
Attack
Roll
Positioning
Ranged attack if relevant

을 시험한다.


# 47. MASK KEEPER — PHASE 1

후보 공격:

## Swipe

근거리 넓은 베기.

Clear windup.

Roll 또는 뒤로 빠져 회피.


## Charge

플레이어 위치 lock
→ 짧은 warning
→ 돌진

벽/끝에서 잠깐 stagger.


## Spirit Burst

주변 또는 방향성 projectile.

positioning 요구.


# 48. MASK KEEPER — PHASE 2

HP 50% 이하:

단순 speed ×1.2에서 끝내지 않는다.

Attack composition 변경.

예:

Double Swipe

Charge
→ Spirit wave

Burst
→ reposition

공격 간 빈틈은 여전히 존재해야 한다.


# 49. BOSS RECOVERY WINDOWS

모든 boss attack 뒤에 공격 기회를 준다.

특히 strong attack:

large danger
→ large punish window

원칙을 따른다.

Boss가 nonstop attack하지 않는다.


# 50. BOSS PRESENTATION

추가 고려:

Arena entrance
Door closes
Camera settles
Boss name
Boss roar
Music transition
Short intro pose
Fight begins

Boss defeat:

hitstop
screen feedback
death animation
music stop
reward reveal

까지 하나의 sequence로 만든다.


# 51. BOSS HEALTH BAR

현재 boss HUD를 개선한다.

단순 rectangular developer bar보다:

Ninja Adventure UI style

에 맞는 panel/frame을 사용한다.

표시:

MASK KEEPER
HP

불필요한 숫자는 숨길 수 있다.


# 52. WORLD DESIGN AUDIT

새 map을 만들기 전에 현재 3개를 평가한다.

Village

Woods

Shrine

각각:

Landmarks
Visual rhythm
Navigation
Exploration
Optional spaces
Secrets
Combat spaces
Empty spaces
Dead ends
Rewards
Storytelling

을 분석한다.


# 53. CURRENT WORLD PHILOSOPHY

현재:

Village
→ Woods
→ Shrine

3개면 Vertical Slice에 충분하다.

새 지역을 추가하지 않는다.

대신 각 map을:

**더 작아도 기억에 남게**

만든다.


# 54. VILLAGE POLISH

Village는 safety와 warmth를 느끼게 한다.

추가 후보:

불빛
연기
NPC 작은 movement
아이들
깃발
물
ambient animals
NPC emotes
shrine landmark
small hidden item

단 asset pack의 시각 language를 유지한다.


# 55. WOODS POLISH

Woods는:

Village보다 위험
하지만 단순 나무 반복은 아님

을 목표로 한다.

구역을 나눈다.

예:

Entrance

River crossing

Dense grove

Combat clearing

Hermit area

Shrine approach

각 구역이 약간 다른 landmark를 가진다.


# 56. SHRINE REDESIGN

현재 Shrine 폭이 viewport와 거의 같아 한 화면처럼 느껴지는지 확인한다.

필요하면:

- viewport/FOV 수정
- map width 변경
- room shape 변경

중 적절한 것을 선택한다.

Shrine는:

Entrance
↓
Combat room
↓
Key
↓
Seal / small puzzle
↓
Shortcut
↓
Boss chamber

처럼 progression이 느껴져야 한다.


# 57. ROOM COMPOSITION

던전 방은 단순 rectangular empty floor가 아니어야 한다.

각 방마다 목적:

Combat

Puzzle

Transition

Reward

Story

Boss

중 하나를 갖게 한다.


# 58. SECRETS

각 map에 1~2개 비밀을 추가한다.

예:

Village
hidden chest


Woods
hidden trail


Shrine
breakable wall / hidden room

비밀은 아주 복잡할 필요 없다.

발견했을 때:

"I found something"

느낌이 중요하다.


# 59. SHORTCUTS

적어도 하나의 meaningful shortcut을 고려한다.

예:

Shrine 후반
→ entrance 근처 shortcut door

탐험이 누적되고 공간 구조를 이해했다는 느낌을 준다.


# 60. ENVIRONMENTAL PUZZLE

Vertical Slice에 1개의 가벼운 환경 puzzle을 넣는 것을 고려한다.

예:

Torch order

Switch

Push statue

Hidden symbol

불필요하게 puzzle framework를 크게 만들지 않는다.


# 61. VISUAL STORYTELLING

대사 없이 환경으로 알려주는 정보 추가.

예:

Village shrine가 꺼져 있음

Woods에서 점점 corruption이 보임

Shrine 내부는 더 어두움

Boss 주변에는 broken masks

Ember 회복 후 분위기 변화

이런 흐름을 visual로 만든다.


# 62. WORLD STATE REACTION

게임 완료가 overlay에서만 끝나지 않게 한다.

Ember restoration 후:

Village shrine lights

warm particles

some NPC dialogue changes

visual tint change if suitable

ambient change

를 추가한다.

플레이어가:

"Quest Complete"

가 아니라:

"내가 세계를 바꿨다"

고 느끼게 한다.


# 63. HUD AUDIT

현재 HUD의 모든 정보를 평가한다.

필요성:

HP
Level
XP
Coin
Map
Quest objective

항상 표시해야 하는지 판단한다.

기본 원칙:

Immediate survival
>
Immediate objective
>
Everything else

이다.


# 64. HUD REDESIGN

평소 화면에서는 최소한만 보이게 한다.

추천:

Top-left:
Hearts

Top-right:
Current objective

Coin / XP:
변화 시 잠깐 toast

Level:
level-up 때만 강조

Map name:
지역 진입 시 잠깐

게임 화면 중앙을 최대한 깨끗하게 유지한다.


# 65. DIALOGUE UI REDESIGN

현재 dialogue panel이 화면 거의 전체 폭을 차지하는지 확인한다.

새 viewport resolution을 확정한 후 다시 디자인한다.

구조:

Portrait
Speaker
Text
Next indicator

우선순위를 명확히 한다.

대화 UI가 개발자용 텍스트 박스가 아니라 RPG UI처럼 보여야 한다.


# 66. DIALOGUE PACING

한 dialogue page는:

1~2개의 짧은 생각

만 담도록 한다.

길게 설명하지 않는다.

필요하면 typewriter 효과를 검토하지만, gameplay delay가 생기면 빠르게 skip 가능하게 한다.


# 67. INVENTORY REDESIGN

현재 텍스트 리스트를 icon-rich RPG UI로 개선한다.

하지만 Diablo grid를 만들지 않는다.

후보:

LEFT
item icon + item list

RIGHT
description + equipment

또는 작은 item cards.

현재 Ninja Adventure item icons를 적극 활용한다.


# 68. QUEST UI

Quest log는:

Quest name
Status
Objectives
Rewards if helpful

만 보여준다.

Debug-like IDs나 불필요한 counters는 숨긴다.


# 69. SHOP

Shop도 단순 text rows를 개선한다.

표시:

Icon
Item name
Price
Owned amount
Description

구매 성공/실패 feedback을 명확하게 한다.


# 70. MAIN MENU REDESIGN

현재 Main Menu의 functional simplicity는 유지한다.

하지만 visual presentation을 개선한다.

후보:

Emberfall logo/title
background shrine scene
ember particles
silhouette
subtle animated environment

메뉴:

Continue
New Game
Options
Credits

Control instructions 전체를 menu bottom에 길게 표시하지 않는다.

필요하면 작은 Controls 메뉴로 이동한다.


# 71. MAIN MENU FIRST IMPRESSION

사용자는 5초 안에:

이게 RPG다
어떤 분위기의 게임인지
어디서 시작하는지

알 수 있어야 한다.


# 72. PIXEL ART UI RULE

현대 web SaaS UI처럼 만들지 않는다.

금지:

큰 radius
glassmorphism
blur cards
generic Tailwind dashboard
Material UI look

사용:

pixel border
wood panel
bitmap font
pixel icon
simple highlight
arrow cursor
small animation


# 73. AUDIO AUDIT

확인:

Title
Village
Woods
Shrine
Boss
Victory

음악 분위기 차이가 명확한지 듣는다.

SFX:

Attack
Hit
Heavy Hit
Roll
Item
Quest
Door
Boss

가 서로 구별되는지 확인한다.


# 74. AUDIO FEEDBACK VARIATION

같은 hit sound 반복이 피곤하면:

detune
2~3 variants

를 사용할 수 있다.

하지만 무작정 많은 오디오 파일을 추가하지 않는다.


# 75. COMBAT RESOURCE LOOP EXPERIMENT

현재 katana + consumable shuriken 구조를 평가한다.

Shuriken이 너무 소모품 같아서 사용되지 않는다면 작은 실험을 할 수 있다.

후보:

melee hit
→ spirit meter charge

ranged attack
→ spirit consume

이런 구조가 gameplay를 개선하는지 prototype한다.

반드시 채택할 필요는 없다.


# 76. DO NOT TURN INTO ANOTHER GAME

다음 게임에서 principle만 참고한다.

Hyper Light Drifter
CrossCode
Eastward
Moonlighter
TUNIC
Death's Door
Minishoot' Adventures
2D Zelda

직접 복제하지 않는다.

캐릭터, map, UI, sprite, music 등을 베끼지 않는다.


# 77. HYPER LIGHT DRIFTER REFERENCE

주로 연구:

combat responsiveness
hit feedback
minimal UI
enemy telegraph
secrets
movement feel
environmental storytelling

Emberfall이 가장 강하게 참고할 game-feel reference 중 하나다.


# 78. CROSSCODE REFERENCE

연구:

web RPG performance
combat readability
enemy combinations
VFX
environment-puzzle integration

하지만 CrossCode의 규모를 따라가지 않는다.


# 79. EASTWARD REFERENCE

연구:

environment density
NPC presentation
small world animation
ambient life
pixel art scene composition

에셋 스타일을 복제하지 않는다.


# 80. MOONLIGHTER REFERENCE

연구:

positioning
timing
combat rooms
enemy combinations
clear risk/reward


# 81. TUNIC REFERENCE

연구:

discovery
secrets
environment clues
player curiosity

설명문을 줄이고 발견을 늘리는 방향에 사용한다.


# 82. DEATH'S DOOR REFERENCE

연구:

melee-ranged loop
simple readable boss patterns
compact combat
world progression


# 83. MINISHOOT REFERENCE

연구:

small interconnected world
shortcuts
ability gates
secrets
responsive movement
compact world density


# 84. NO CONTENT BLOAT

이번 개선에서 절대 목표로 하지 않을 것:

10 maps
30 enemies
100 items
skill tree
crafting
multiplayer
huge story
procedural world

작고 완성도 높은 게임을 유지한다.


# 85. PERFORMANCE TEST AUTOMATION

기존 Playwright suite를 유지한다.

추가 test:

viewport-scaling.spec.ts

performance-smoke.spec.ts

visual-smoke.spec.ts

정도를 검토한다.


# 86. VIEWPORT TEST

자동 테스트로:

canvas bounding box

aspect ratio

overflow

visibility

를 검사한다.

각 viewport screenshot도 저장한다.


# 87. PERFORMANCE SMOKE

DEV test bridge에서 가능하면:

fps sample
frame time
enemy count
hitbox count
particle count

를 노출한다.

단 production에서는 노출하지 않는다.


# 88. TRANSITION BENCHMARK

Playwright에서:

Village → Woods

Woods → Shrine

transition에 걸린 시간을 기록한다.

목표 수치를 맹목적으로 정하지 말고 baseline 대비 개선한다.


# 89. INPUT LATENCY TEST

완전한 hardware input latency를 브라우저 test로 측정할 수는 없다.

대신:

keydown
→ movement state
→ position change

attack key
→ attack state
→ first attack frame

등의 logical delay를 측정할 수 있다.

이 데이터를 보조적으로 사용한다.


# 90. SCREENSHOT COMPARISON

화면/디자인 변경 후 반드시 Before / After screenshot을 비교한다.

특히:

Main Menu

Village

Combat

Dialogue

Inventory

Shrine

Boss

Ending


# 91. QUALITY BAR

아래 질문에서 Yes가 늘어나는 방향으로 개선한다.

## Visual

스크린샷 한 장만 봐도 실제 게임처럼 보이는가?


## Movement

아무 목적 없이 움직여도 느낌이 좋은가?


## Combat

공격이 맞았을 때 만족스러운가?


## Enemies

왜 공격당했는지 이해할 수 있는가?


## Boss

일반 몬스터와 명확히 다른가?


## World

방문한 장소를 기억할 수 있는가?


## UI

게임을 가리지 않고 정보를 전달하는가?


## Performance

긴 frame spike 없이 안정적인가?


# 92. PRIORITY ORDER

기본적으로 다음 순서로 진행한다.


# P0 — BASELINE & SCREEN

1. Environment audit
2. Run browser
3. Baseline screenshots
4. Viewport matrix
5. FOV / scale experiment
6. Final display strategy


# P0 — GAME FEEL

7. Movement audit
8. Attack timing
9. Roll timing
10. Input buffer
11. Cancel windows
12. Hitstop
13. Camera


# P0 — BOSS

14. Mask Keeper redesign
15. boss controller
16. patterns
17. phases
18. intro
19. death/reward


# P1 — ENEMIES

20. Telegraph
21. Separation
22. Combat combinations


# P1 — UI

23. HUD
24. Dialogue
25. Inventory
26. Quest
27. Shop
28. Main Menu


# P1 — WORLD

29. Village polish
30. Woods polish
31. Shrine polish
32. Secret
33. Shortcut
34. Environmental puzzle
35. Ending world reaction


# P2 — PERFORMANCE

36. allocations
37. HUD updates
38. asset prefetch
39. music optimization
40. transition latency


# P2 — QA

41. visual tests
42. performance tests
43. browser matrix
44. full playthrough
45. final polish


# 93. IMPORTANT PRIORITY RULE

P0가 완료되기 전에 새 map이나 새로운 대형 시스템을 만들지 않는다.

특히:

화면
조작감
전투
보스

가 먼저다.


# 94. KEEP GOOD EXISTING SYSTEMS

다음은 문제가 없다면 유지한다.

Typed game data

Quest system

Inventory system

IndexedDB save

Tiled workflow

Map validator

Test bridge

Playwright E2E

Vitest

Input action abstraction

Scene architecture

Player FSM

Hitbox/Hurtbox architecture

현재 architecture가 상당히 괜찮다면 괜히 바꾸지 않는다.


# 95. REFACTOR ONLY WHEN NEEDED

예:

BaseEnemy에 boss 전용 조건이 너무 많아질 경우

→ Boss controller 분리

UI 전체가 하나의 파일 때문에 수정이 너무 어려울 경우

→ components 분리

하지만 "깔끔해 보이기 위해" 대규모 refactor하지 않는다.


# 96. UI REFACTOR

현재 UIScene이 매우 커졌다면 시각 개선 과정에서 필요할 경우:

HUDView

DialogueView

InventoryView

QuestView

ShopView

BossHUD

등으로 작은 component/module 분리를 검토한다.

UIScene은 orchestration을 담당한다.

단 한번에 전체 rewrite하지 않는다.


# 97. BOSS ARCHITECTURE

Boss는 필요하다면:

MaskKeeper.ts

또는:

BossController
BossAttackPattern

으로 분리한다.

일반 enemy와 공유 가능한:

Health
HitFeedback
Hitbox

는 계속 공유한다.


# 98. ART POLISH WITHOUT NEW ASSETS

새 asset 없이도 다음으로 품질을 올릴 수 있다.

Ambient particle

Sprite animation

Small tint

Lighting simulation

Water animation

Grass movement

NPC emote

Screen transition

Camera

UI layout

Sound

새 asset 다운로드보다 먼저 기존 asset을 활용한다.


# 99. ACCESSIBILITY

유지/개선:

Screen shake toggle
Volume controls
Keyboard complete play
Gamepad
Readable text
High contrast
Pause on blur

추가 검토:

Fullscreen

Display scaling mode

Key hints matching controller


# 100. GAMEPAD UI

게임패드 연결 시 가능하면:

E
J
K

같은 keyboard hint 대신:

A
X
B

등 적절한 glyph를 표시하는 구조를 검토한다.

필수는 아니지만 polish 가치가 높다.


# 101. SAVE EXPERIENCE

저장 구조는 유지한다.

추가 개선:

Autosave icon / toast를 너무 자주 띄우지 않는다.

Save failure만 사용자에게 명확히 알린다.

Continue가 안정적으로 작동해야 한다.


# 102. FAILURE HANDLING

작업 중 browser crash / missing asset / runtime error가 있으면:

error
→ reproduce
→ source locate
→ fix
→ retest

한다.

임시 try/catch로 문제를 숨기지 않는다.


# 103. DOCUMENT WORK

이번 작업 동안 유지:

docs/POLISH_AUDIT.md

docs/PERFORMANCE.md

docs/SCREEN_SCALING.md

docs/PLAYTEST_NOTES.md

필요하면:

docs/BOSS_DESIGN.md

을 추가한다.


# 104. POLISH AUDIT FORMAT

`docs/POLISH_AUDIT.md`

예:

## Screen Scaling

Current:
2/5

Problem:
MAX_ZOOM drops from 3x to 2x at common viewport heights.

Evidence:
1440×800 screenshot.

Change:
...

Result:
...


# 105. PERFORMANCE DOCUMENT

기록:

Scene
Viewport
Average FPS
Frame time
Worst spike
Enemies
Notes

Before / After를 남긴다.


# 106. SCREEN SCALING DOCUMENT

비교:

480×270 integer

480×270 fit

384×216 integer

320×180 integer

screenshots와 결과를 남긴다.

최종 선택 이유를 기록한다.


# 107. PLAYTEST NOTES

각 major change 후:

What felt better
What still felt wrong
Unexpected issues
Decision

을 짧게 남긴다.


# 108. USER COMMUNICATION

작업 중 사용자에게 다음 정도만 알려라.

Example:

"화면비 자체는 16:9로 정상입니다. 대신 1440×800에서 integer scale이 3x→2x로 떨어져 게임이 작아지는 문제가 확인됐습니다. 320×180/384×216/FIT을 비교 중이며 현재는 320×180이 전투 가독성이 가장 좋습니다."

이런 식으로 구체적으로 보고한다.

tool log를 그대로 보여주지 않는다.


# 109. DO NOT ASK UNNECESSARY QUESTIONS

이미 판단 가능한 것은 직접 진행한다.

사용자에게 물어야 하는 경우:

paid asset purchase

production deploy

delete user work

external account/credential

major genre change

정도다.


# 110. GIT SAFETY

작업 시작:

git status

사용자 변경사항 보존.

필요하면 작은 commit 단위:

fix: improve pixel scaling behavior

feat: sync attack timing with animation

feat: redesign mask keeper boss patterns

refactor: split hud view from ui scene

perf: prefetch adjacent map audio

사용자가 요청하지 않았다면 remote push를 임의로 하지 않는다.


# 111. COMPLETION TEST

개선 완료라고 말하기 전에 반드시 처음부터 플레이한다.

Sequence:

Main Menu

New Game

Village

Talk to Hana

Talk to Ryo

Combat tutorial

Woods

Fight multiple enemies

Chest

Inventory

Shrine

Puzzle/Key

Boss

Ember

Return

Relight Shrine

Ending

Refresh

Continue


# 112. FINAL BROWSER MATRIX

최소:

1366×768

1440×900

1920×1080

에서 완주 가능 여부 확인.

가능하면 Firefox / Chromium도 확인.


# 113. FINAL SCREEN CHECK

각 화면에 대해 확인:

Pixel sharp

No clipping

Readable

Correct scale

UI doesn't block action

No accidental browser scroll

No weird letterbox

No shimmering camera


# 114. FINAL PERFORMANCE CHECK

특히:

Woods combat

Boss fight

map transitions

에서 frame spikes 확인.

단순 평균 FPS만 보고 완료하지 않는다.


# 115. FINAL GAME FEEL CHECK

5분 동안 아무 목표 없이:

Move

Roll

Attack

Combo

Fight

만 해본다.

그 자체가 재미없다면 아직 polish가 부족하다.


# 116. SUCCESS DEFINITION

성공은:

"기능이 더 많아졌다"

가 아니다.

성공은:

처음 실행했을 때 화면이 자연스럽고

움직임이 즉각적이고

공격이 만족스럽고

적 공격이 읽히고

보스가 기억에 남으며

UI가 실제 RPG처럼 보이고

현재 3개의 작은 map이 탐험할 만하며

browser에서 안정적으로 실행되는 것

이다.


# 117. TARGET IDENTITY

최종 Emberfall의 방향은 대략:

**Compact action RPG**

with:

Hyper Light Drifter-like responsiveness

+

classic Zelda-like exploration clarity

+

Eastward-like environmental warmth

를 참고하되,

시각적/콘텐츠적 복제를 하지 않는다.


# 118. KEEP THE PROJECT SMALL

최종적으로도:

12~20분

정도의 작은 Vertical Slice여도 괜찮다.

대신 그 12~20분이:

밀도 높고

완성도 있고

기억에 남아야 한다.


# 119. FIRST EXECUTION PLAN

이 프롬프트를 받으면 다음부터 바로 시작한다.

## Step 1

Repository / git / docs audit


## Step 2

Current game run


## Step 3

Baseline screenshots


## Step 4

Viewport matrix


## Step 5

Performance baseline


## Step 6

Screen/FOV prototypes


## Step 7

Choose final screen strategy


## Step 8

Attack / Roll / Camera polish


## Step 9

Hit feedback / enemy telegraph


## Step 10

Boss redesign


## Step 11

UI redesign


## Step 12

World polish


## Step 13

Loading/performance


## Step 14

Regression tests


## Step 15

Full playthrough


# 120. FIRST REPORT

첫 번째 보고는 다음 형식으로 작성한다.

# EMBERFALL AUDIT

## Current Overall Score

x / 5


## Strongest Parts

...


## Biggest Problems

1.
2.
3.
...


## Runtime Findings

...


## Screen Scaling

...


## Performance

...


## Combat Feel

...


## Boss

...


## UI

...


## World Design

...


## Comparison References

Hyper Light Drifter:
...

CrossCode:
...

Eastward:
...

Moonlighter:
...

TUNIC:
...

Death's Door:
...

Minishoot:
...


## Recommended Direction

...


## Implementation Order

P0
...

P1
...

P2
...


그 후 보고만 하고 멈추지 않는다.

특별한 blocker가 없다면 바로 P0 구현을 시작한다.


# 121. FINAL AUTONOMOUS INSTRUCTION

너의 workflow는 항상:

Inspect
↓
Research
↓
Measure
↓
Prototype
↓
Compare
↓
Decide
↓
Implement
↓
Run
↓
Play
↓
Screenshot
↓
Profile
↓
Fix
↓
Retest

이어야 한다.

절대로:

Code
↓
"It should work"

에서 끝내지 않는다.


# 122. MOST IMPORTANT RULE

현재 Emberfall에서 더 중요한 것은:

MORE CONTENT

가 아니라:

BETTER FEEL

이다.

우선순위:

Screen / FOV
>
Movement / Combat
>
Boss
>
Enemy Readability
>
UI
>
World Density
>
Loading
>
Performance
>
Additional Content

순으로 유지한다.


# 123. START NOW

이제 `emberfall-rpg` repository와 현재 로컬 runtime을 조사한다.

현재 사용자가 만든 코드를 보존한다.

먼저 실제 현재 상태를 측정하고 baseline을 확보한다.

그 다음 가장 큰 문제부터 직접 수정하고 실제 브라우저 플레이테스트를 반복한다.

사용자에게 작은 판단을 계속 넘기지 말고, 여러 후보가 있으면 직접 비교해서 더 좋은 방향을 선택한다.

최종 목표는 단순히 작동하는 웹게임이 아니라:

**브라우저에서 실행되는 작지만 완성도 높은 인디 2D Action RPG**

로 Emberfall을 끌어올리는 것이다.