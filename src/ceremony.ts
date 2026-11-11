import { SUN_AZ } from './desert.ts'
import { HOLSTER_MS } from './gun.ts'
import { horizonY, makeCamera, type Camera } from './render.ts'

// 판 끝 (사용자 결정 2026-11-11, SHEEP-187 시안 A. SHEEP-169·172의 검은 화면 포스터, 뒷모습, 자막 카드를 끊김 없는 한 장면으로 바꿈).
// 승리 결과 시간이 끝나는 시각(준비 중 시각, 서버 시계)에서 거꾸로 잼. 서버 RoundFlow.WinResultDuration 18.5초를 셋으로 나눔.
// 'fall': 결과를 받은 때부터 약 5.5초(FALL_MS). 이긴 사람은 1인칭으로 마지막 쓰러짐을 자기 눈으로 보고 총을 돌려 권총집에 넣음.
//         내 한 발로 끝냈으면 쓰러지는 사람에게 확 줌해 느리게 봄 (SHEEP-194). 진 사람은 지금처럼 마지막 쓰러짐을 위에서 느리게 봄 (SHEEP-169)
// 'pull': PULL_MS 동안 카메라가 이긴 사람 눈(진 사람은 위에서 보던 자리)에서 이긴 사람 뒤로 빠지고, 이긴 사람은 해 쪽으로 돌아섬
// 'walk': WALK_MS 동안 이긴 사람이 석양으로 걸어가고, 가장자리부터 살짝 어두워지며 결과 보드를 하나씩 띄움(boardTimes).
//         끝 END_FADE_MS 동안 검게 닫혀 술집으로 넘어감

// ms. ponytail: 임시 값. 플레이해 보며 정함
export const PULL_MS = 2500
export const WALK_MS = 10500
export const END_FADE_MS = 1000
// 'fall' 단계 길이. 서버 승리 결과 시간 18.5초에서 PULL_MS와 WALK_MS를 뺀 것. 결정타 줌을 넣으며 4초에서 늘림 (SHEEP-194)
export const FALL_MS = 5500
// ms. 카메라가 빠지는 동안 이긴 사람이 돌아서기 시작하는 때(pull 시작부터)와 다 돌기까지
export const TURN_AT = 900
export const TURN_FOR = 1400
// ms. 마지막 쓰러짐 보기를 시작하고 이만큼 뒤에 쓰러뜨린 이 자막 카드를 띄움 (SHEEP-180). 장면이 바뀌자마자 글자를 띄우지 않고 뜸을 들임
export const FALL_CARD_AT = 1000
// 마지막 쓰러짐을 늦추는 배율과 바닥에 닿은 뒤 피 웅덩이를 빨리 감는 배율
export const SLOW = 0.4
export const BLEED = 4
// 시간 초과(자살)를 늦추는 배율. 옆머리를 쏘는 동작(0.7초)부터 틀어 SLOW로는 위에서 보는 동안 바닥에 닿지 못해 더 빨리 틂 (SHEEP-172)
export const SUICIDE_SLOW = 0.8

// 결과 보드가 뜨는 때(걷기 시작부터 ms). 어두워짐, 포스터, 도장, 서부 문구, 전 잔고, +$100, 잔고 세어 올리기 시작과 끝, 킬 수.
// 앞 것이 자리 잡고 뜸을 들인 뒤 다음 것을 띄움 (사용자 결정 2026-11-11, SHEEP-187). ponytail: 임시 값. 플레이해 보며 정함
const WON_BOARD = { dim: 0, poster: 1500, stamp: 2100, phrase: 3600, money: 4800, plus: 5600, count: 6100, counted: 7300, kills: 8500 }
export type BoardKey = keyof typeof WON_BOARD
// 진 사람은 받는 돈이 없어 지금 잔고만 보이고(+$100과 세어 올리기 없음), 킬 수를 잔고 뒤 같은 뜸으로 당김 (사용자 결정 2026-11-11)
export const boardTimes = (won: boolean): Record<BoardKey, number | null> =>
  won ? WON_BOARD : { ...WON_BOARD, plus: null, count: null, counted: null, kills: WON_BOARD.money + (WON_BOARD.money - WON_BOARD.phrase) }
// ms. 도장이 돌며 떨어져 종이에 찍히기까지. style.css #ending .stamp 애니메이션과 같은 값. 찍히는 소리를 이때 냄
export const STAMP_FALL = 240

// 1인칭 결정타 박자 (이긴 사람만). 내 한 발로 마지막 사람이 쓰러지면 쓰러짐을 보이는 순간 HITSTOP_MS 동안 화면을 멈추고 확인음을 냄.
// 쓰러진 몸이 바닥에 닿고 SPIN_PAUSE 뒤 총을 손가락에 걸어 SPIN_TURNS 바퀴 돌리고(SPIN_MS, 처음 빨리 나중엔 천천히),
// SPIN_HOLD 뒤 HOLSTER_MS 동안 권총집에 넣음. ponytail: 임시 값. 플레이해 보며 정함
export const HITSTOP_MS = 120
export const SPIN_PAUSE = 700
export const SPIN_MS = 900
export const SPIN_TURNS = 2
export const SPIN_HOLD = 300
export const SPIN_END = SPIN_MS + SPIN_HOLD + HOLSTER_MS
// ms. 결과를 보인 때부터 늦어도 이때 돌리기 시작함. 마지막 쓰러짐 보기(FALL_MS)에서 결과가 늦게 보이는 0.3초와 돌려 넣기를 뺌.
// 시간 초과(자살)는 옆머리를 쏘는 동작부터라 바닥에 늦게 닿아, 뜸을 다 들이면 넣기 전에 카메라가 빠짐
const SPIN_LATEST = FALL_MS - 300 - SPIN_END
// 쓰러짐을 보인 때부터 돌리기 시작하기까지(ms). landed는 쓰러진 몸이 바닥에 닿기까지(sound.ts fallDelay)
export const spinDelay = (landed: number) => Math.max(landed, Math.min(landed + SPIN_PAUSE, SPIN_LATEST))

// 결정타 줌 (사용자 결정 2026-11-11, SHEEP-194 시안 A). 내 한 발로 마지막 사람이 쓰러지면 히트스톱이 끝나는 때 내 눈 그대로 시야를
// ZOOM_IN_MS 만에 FINISH_FOV로 좁혀 쓰러지는 몸을 화면 가득 담고, 몸은 바닥에 닿기까지 FINISH_SLOW배로 느리게 쓰러짐.
// 닿고 ZOOM_HOLD 뒤 ZOOM_OUT_MS 동안 시야를 되돌리고 SPIN_GAP 뒤 총을 돌려 넣음. ponytail: 임시 값. 플레이해 보며 정함
export const FINISH_FOV = 18
export const FINISH_SLOW = 0.5
export const ZOOM_IN_MS = 160
export const ZOOM_HOLD = 600
export const ZOOM_OUT_MS = 450
const SPIN_GAP = 150
// 칸. 줌하는 동안 보는 점. 서 있으면 가슴 높이, 누우면 등 뒤로 LIE_BACK만큼 간 누운 몸 가운데의 바닥 가까이
const CHEST_UP = 0.55
const LIE_BACK = 0.45
const LIE_UP = 0.12

// 쓰러짐을 보인 때부터 바닥에 닿기까지(ms). land는 바닥에 닿는 동작 시간(sound.ts fallDelay)
export const finishLanded = (land: number) => HITSTOP_MS + land / FINISH_SLOW
// 쓰러짐을 보인 때부터 총을 돌리기 시작하기까지(ms)
export const finishSpin = (land: number) => finishLanded(land) + ZOOM_HOLD + ZOOM_OUT_MS + SPIN_GAP

// 쓰러짐을 보인 지 seen(ms) 지난 때 그 몸의 동작 시간(ms). 히트스톱 동안 멈춘 자리에서 이어 느리게 쓰러지고, 바닥에 닿은 뒤로는 제 빠르기
export function finishMotion(seen: number, land: number): number {
  if (seen < 0) return seen
  const u = seen - HITSTOP_MS
  if (u <= 0) return 0
  const landed = land / FINISH_SLOW
  return u <= landed ? u * FINISH_SLOW : land + (u - landed)
}

// 쓰러짐을 보인 지 seen(ms) 지난 때의 줌 정도. 0 기본 시야 ~ 1 FINISH_FOV. 당길 때는 확(ease-out), 되돌릴 때는 처음과 끝이 느림
export function finishZoom(seen: number, land: number): number {
  const k = Math.min(1, Math.max(0, (seen - HITSTOP_MS) / ZOOM_IN_MS))
  const back = Math.min(1, Math.max(0, (seen - finishLanded(land) - ZOOM_HOLD) / ZOOM_OUT_MS))
  return (1 - (1 - k) ** 3) * (1 - (back < 0.5 ? 4 * back ** 3 : 1 - (-2 * back + 2) ** 3 / 2))
}

// 줌 정도 z일 때의 시야(도). 화면에 보이는 크기가 고르게 커지도록 시야 절반의 tan을 곱으로 섞음
export function zoomFov(fov: number, z: number): number {
  const wide = Math.tan((fov * Math.PI) / 360)
  const narrow = Math.tan((FINISH_FOV * Math.PI) / 360)
  return (360 / Math.PI) * Math.atan(wide * (narrow / wide) ** z)
}

// 줌하는 동안 보는 쪽과 위아래 시선(라디안). eye는 내 눈 자리, (x, y)는 쓰러지는 사람 발 자리, facing은 그 사람이 보던 쪽.
// 그 사람은 뒤로 넘어지므로(motions.json Death01) 바닥에 닿아 갈수록 등 뒤 누운 몸 가운데를 봄
export function finishLook(eye: { x: number; y: number; z: number }, x: number, y: number, facing: number, motion: number, land: number) {
  const k = smooth(motion / land)
  const px = x - Math.cos(facing) * LIE_BACK * k
  const py = y - Math.sin(facing) * LIE_BACK * k
  const up = CHEST_UP + (LIE_UP - CHEST_UP) * k
  return { angle: Math.atan2(py - eye.y, px - eye.x), pitch: -Math.atan((eye.z - up) / Math.hypot(px - eye.x, py - eye.y)) }
}

// 돌리기 시작하고 since(ms) 지난 때 총을 돌린 각(라디안, 총구가 앞아래로 넘어가는 쪽이 +)과 내린 정도(0 듦 ~ 1 권총집에 다 넣음, ease-in)
export function spinGun(since: number): { spin: number; lower: number } {
  if (since <= 0) return { spin: 0, lower: 0 }
  if (since < SPIN_MS) return { spin: SPIN_TURNS * 2 * Math.PI * (1 - (1 - since / SPIN_MS) ** 2), lower: 0 }
  return { spin: 0, lower: Math.min(1, Math.max(0, (since - SPIN_MS - SPIN_HOLD) / HOLSTER_MS)) ** 3 }
}

// 마지막 쓰러짐을 늦추는 배율 (진 사람이 위에서 볼 때)
export const fallSlow = (reason: 'shot' | 'timeout') => (reason === 'timeout' ? SUICIDE_SLOW : SLOW)

export type EndingStage = 'fall' | 'pull' | 'walk'

// 마지막 쓰러짐을 보인 지 elapsed(ms) 지났을 때의 동작 시간(ms). land는 바닥에 닿는 동작 시간(시간 초과면 옆머리를 쏘는 동작까지), slow는 닿을 때까지의 배율(fallSlow)
export function lastFallMotion(elapsed: number, land: number, slow: number): number {
  const landed = land / slow
  return elapsed <= landed ? elapsed * slow : land + (elapsed - landed) * BLEED
}

// now(서버 시계)의 판 끝 단계와 그 단계가 시작하고 지난 시간(ms). 'fall'은 결과를 받은 때부터라 시작이 사람마다 달라, pull까지 남은 시간을 음수로 줌
export function endingAt(end: number, now: number): { stage: EndingStage; elapsed: number } {
  const walk = end - WALK_MS
  const pull = walk - PULL_MS
  if (now >= walk) return { stage: 'walk', elapsed: now - walk }
  if (now >= pull) return { stage: 'pull', elapsed: now - pull }
  return { stage: 'fall', elapsed: now - pull }
}

// 걷기 시작부터 elapsed(ms)에 보이는 잔고. 세어 올리기 전에는 from, 그동안은 $10씩 처음 빨리 나중엔 천천히, 뒤로는 to
export function balanceAt(elapsed: number, from: number, to: number): number {
  if (elapsed < WON_BOARD.count) return from
  const u = Math.min(1, (elapsed - WON_BOARD.count) / (WON_BOARD.counted - WON_BOARD.count))
  return from + Math.round(((to - from) * (1 - (1 - u) ** 2)) / 10) * 10
}

// 잔고가 $10씩 오르는 때(걷기 시작부터 ms). 오를 때마다 동전 소리를 냄. balanceAt의 반올림이 다음 $10로 넘어가는 때
export function coinTimes(from: number, to: number): number[] {
  const steps = Math.round((to - from) / 10)
  return Array.from({ length: Math.max(0, steps) }, (_, i) => {
    const eased = (i + 0.5) / steps
    return WON_BOARD.count + (1 - Math.sqrt(1 - eased)) * (WON_BOARD.counted - WON_BOARD.count)
  })
}

// 해가 있는 쪽(라디안). 하늘의 해는 늘 같은 방위에 있음 (desert.ts)
const SUN = (SUN_AZ * Math.PI) / 180
// 칸/ms. 결투 전 걸음과 같은 빠르기(0.3칸을 0.7초에, SHEEP-141)
const PACE = 0.3 / 700
// 칸. 카메라는 이긴 사람이 선 자리에서 해 반대쪽으로 BACK, 높이 UP에서 해 쪽을 보고 움직이지 않아 걸어가는 사람이 점점 작아짐.
// ponytail: 둘레만 벽인 21칸 결투장이라 다 걸은 자리(중심에서 4칸)에서 어느 쪽으로 BACK을 물러나도 벽에 닿지 않음. 맵에 벽이 생기면 카메라를 벽 앞에서 멈춤
const BACK = 2.2
const UP = 0.75

// 카메라 자리와 보는 쪽. 둘 사이를 이어 카메라를 옮길 때 씀. angle·pitch는 라디안, z는 눈높이(칸)
export type View = { x: number; y: number; angle: number; pitch: number; z: number }
export const toCamera = (v: View, fov: number): Camera => ({ ...makeCamera(v.x, v.y, v.angle, fov, v.pitch), z: v.z })

// 이긴 사람이 (x, y)에서 걷기 시작해 elapsed(ms) 지난 자리와 바라보는 쪽
export const walkerAt = (x: number, y: number, elapsed: number) => ({ x: x + Math.cos(SUN) * PACE * elapsed, y: y + Math.sin(SUN) * PACE * elapsed, facing: SUN })

// 이긴 사람이 선 자리(x, y) 뒤에서 해 쪽을 보는 자리. 걸어가는 사람의 발밑이 화면 가운데 조금 아래에 오게 살짝 내려다봄
export const walkoffView = (x: number, y: number): View => ({ x: x - Math.cos(SUN) * BACK, y: y - Math.sin(SUN) * BACK, angle: SUN, pitch: -Math.atan((UP - 0.5) / (BACK + 2)), z: UP })
export const walkoffCamera = (x: number, y: number, fov: number): Camera => toCamera(walkoffView(x, y), fov)

// 칸. 마지막 쓰러짐을 보는 카메라는 그 사람이 바라보던 쪽 앞 위에서 발을 내려다보고, 보는 동안 조금씩 물러나며 올라감 (SHEEP-119의 장면을 다시 씀).
// 뒤로 넘어지면 머리가 화면 위쪽으로 감. ponytail: 임시 값
const FROM = { back: 2.4, up: 2.0 }
const TO = { back: 2.7, up: 2.3 }
// ms. 물러나며 올라가는 데 걸리는 시간. 위에서 보는 동안
const DRIFT_MS = FALL_MS
// 칸. 내려다보는 점의 높이. 발목쯤이라 서 있을 때 모자까지, 누우면 몸 전체가 화면 가운데 줄에 듦
const AIM_UP = 0.2

// 마지막으로 쓰러지는 사람을 보는 자리. x, y는 그 사람 발 자리(칸), facing은 쓰러질 때 바라보던 각도, elapsed는 보기 시작하고 지난 시간(ms)
export function lastFallView(x: number, y: number, facing: number, elapsed: number): View {
  const u = Math.min(1, Math.max(0, elapsed / DRIFT_MS))
  const back = FROM.back + (TO.back - FROM.back) * u
  const up = FROM.up + (TO.up - FROM.up) * u
  return { x: x + Math.cos(facing) * back, y: y + Math.sin(facing) * back, angle: facing + Math.PI, pitch: -Math.atan((up - AIM_UP) / back), z: up }
}

const smooth = (k: number) => {
  const u = Math.min(1, Math.max(0, k))
  return u * u * (3 - 2 * u)
}
// 각 차이를 -π ~ π로. 짧은 쪽으로 돌게 함
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// 카메라가 from에서 to로 빠지는 동안 pull 시작부터 elapsed(ms)의 자리. 처음과 끝이 느림. 보는 쪽과 높이는 앞 절반에 먼저 맞춰,
// 진 사람이 위에서 내려다보던 카메라가 옮겨 가는 동안 땅만 보지 않고 석양과 이긴 사람을 봄 (SHEEP-187 리뷰). 보는 쪽은 짧은 쪽으로 돎
export function pullView(from: View, to: View, elapsed: number): View {
  const u = smooth(elapsed / PULL_MS)
  const look = smooth((2 * elapsed) / PULL_MS)
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  return {
    x: lerp(from.x, to.x, u),
    y: lerp(from.y, to.y, u),
    angle: from.angle + wrap(to.angle - from.angle) * look,
    pitch: lerp(from.pitch, to.pitch, look),
    z: lerp(from.z, to.z, look),
  }
}

// pull 시작부터 elapsed(ms)에 이긴 사람이 보는 쪽. from(마지막 상대를 보던 쪽)에서 해 쪽으로 짧은 쪽으로 돌아섬
export const turnFacing = (from: number, elapsed: number) => from + wrap(SUN - from) * smooth((elapsed - TURN_AT) / TURN_FOR)

// 세계의 점(x, y, 높이 z)이 놓이는 화면 자리(px). 사람 그림(sprite.ts)과 같은 투영이라 머리 위 닉네임이 머리를 따라감. 카메라 뒤면 null
export function onScreen(cam: Camera, x: number, y: number, z: number, w: number, h: number): { x: number; y: number } | null {
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY)
  const rx = x - cam.x
  const ry = y - cam.y
  const depth = invDet * (cam.planeX * ry - cam.planeY * rx)
  if (depth <= 0.05) return null
  const side = invDet * (cam.dirY * rx - cam.dirX * ry)
  return { x: (w / 2) * (1 + side / depth), y: horizonY(h, proj, cam.pitch) + (proj * ((cam.z ?? 0.5) - z)) / depth }
}
