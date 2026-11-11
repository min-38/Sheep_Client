import { SUN_AZ } from './desert.ts'
import { makeCamera, type Camera } from './render.ts'

// 판 끝 (사용자 결정 2026-11-11, SHEEP-169 시안 B. SHEEP-136·150의 세레모니를 바꿈). 승리 결과 시간이 끝나는 시각(준비 중 시각, 서버 시계)에서
// 거꾸로 잼. 결과를 받은 때부터 포스터 전까지 모두가 마지막 쓰러짐을 위에서 느리게 봄(서버 RoundFlow.WinResultDuration 12초에서
// 아래 셋을 뺀 약 4초). 바닥에 닿을 때까지는 SLOW배로 느리게, 닿은 뒤로는 피 웅덩이가 번지는 것이 보이게 BLEED배로 빨리 감음
// (사용자 요청 2026-11-11: 쓰러져 피 흘리는 데까지 보임). 이긴 사람 1인칭으로 넘어가지 않고 검은 화면에 돈 없는 WANTED 포스터를 POSTER_MS(뜬 뒤 Winner 도장을 쾅 찍음, SHEEP-172), 이긴 사람이 해 쪽으로 걸어가는
// 뒷모습을 WALKOFF_MS(마지막 IRIS_MS 동안 화면이 동그랗게 닫힘), 검은 화면 자막 카드를 CARD_MS 동안 보인 뒤 술집으로 넘어감.
// 자막 카드에는 이긴 사람에게만 받은 돈을, 모두에게 자기 킬 수를 보임

// ms. ponytail: 임시 값. 플레이해 보며 정함
export const POSTER_MS = 2500
export const WALKOFF_MS = 2500
export const IRIS_MS = 1200
export const CARD_MS = 3000
// ms. 포스터가 뜨고 Winner 도장이 돌며 떨어지기 시작하는 때와, 떨어져 종이에 찍히기까지 (SHEEP-172 B안). style.css #win .stamp 애니메이션과 같은 값
export const STAMP_AT = 600
export const STAMP_FALL = 240
// 마지막 쓰러짐을 늦추는 배율과 바닥에 닿은 뒤 피 웅덩이를 빨리 감는 배율
export const SLOW = 0.4
export const BLEED = 4
// 시간 초과(자살)를 늦추는 배율. 옆머리를 쏘는 동작(0.7초)부터 틀어 SLOW로는 위에서 보는 동안 바닥에 닿지 못해 더 빨리 틂 (SHEEP-172)
export const SUICIDE_SLOW = 0.8

// 쓰러진 사유별로 마지막 쓰러짐을 늦추는 배율
export const fallSlow = (reason: 'shot' | 'timeout') => (reason === 'timeout' ? SUICIDE_SLOW : SLOW)

export type EndingStage = 'top' | 'poster' | 'walk' | 'card'

// 마지막 쓰러짐을 보인 지 elapsed(ms) 지났을 때의 동작 시간(ms). land는 바닥에 닿는 동작 시간(시간 초과면 옆머리를 쏘는 동작까지), slow는 닿을 때까지의 배율(fallSlow)
export function lastFallMotion(elapsed: number, land: number, slow: number): number {
  const landed = land / slow
  return elapsed <= landed ? elapsed * slow : land + (elapsed - landed) * BLEED
}

// now(서버 시계)의 판 끝 단계와 그 단계가 시작하고 지난 시간(ms). 'top'은 결과를 받은 때부터라 시작이 사람마다 달라, 포스터까지 남은 시간을 음수로 줌
export function endingAt(end: number, now: number): { stage: EndingStage; elapsed: number } {
  const card = end - CARD_MS
  const walk = card - WALKOFF_MS
  const poster = walk - POSTER_MS
  if (now >= card) return { stage: 'card', elapsed: now - card }
  if (now >= walk) return { stage: 'walk', elapsed: now - walk }
  if (now >= poster) return { stage: 'poster', elapsed: now - poster }
  return { stage: 'top', elapsed: now - poster }
}

// 서버 시각. 승리 결과가 끝나는 end에서 거꾸로 잰, Winner 도장이 종이에 찍히는 때. 찍히는 소리를 이 시각에 예약함
export const stampHitAt = (end: number) => end - CARD_MS - WALKOFF_MS - POSTER_MS + STAMP_AT + STAMP_FALL

// 해가 있는 쪽(라디안). 하늘의 해는 늘 같은 방위에 있음 (desert.ts)
const SUN = (SUN_AZ * Math.PI) / 180
// 칸/ms. 결투 전 걸음과 같은 빠르기(0.3칸을 0.7초에, SHEEP-141)
const PACE = 0.3 / 700
// 칸. 카메라는 이긴 사람이 선 자리에서 해 반대쪽으로 BACK, 높이 UP에서 해 쪽을 보고 움직이지 않아 걸어가는 사람이 점점 작아짐.
// ponytail: 둘레만 벽인 21칸 결투장이라 다 걸은 자리(중심에서 4칸)에서 어느 쪽으로 BACK을 물러나도 벽에 닿지 않음. 맵에 벽이 생기면 카메라를 벽 앞에서 멈춤
const BACK = 2.2
const UP = 0.75

// 이긴 사람이 (x, y)에서 걷기 시작해 elapsed(ms) 지난 자리와 바라보는 쪽
export const walkerAt = (x: number, y: number, elapsed: number) => ({ x: x + Math.cos(SUN) * PACE * elapsed, y: y + Math.sin(SUN) * PACE * elapsed, facing: SUN })

// 이긴 사람이 선 자리(x, y) 뒤에서 해 쪽을 보는 카메라. 걸어가는 사람의 발밑이 화면 가운데 조금 아래에 오게 살짝 내려다봄
export function walkoffCamera(x: number, y: number, fov: number): Camera {
  const cam = makeCamera(x - Math.cos(SUN) * BACK, y - Math.sin(SUN) * BACK, SUN, fov, -Math.atan((UP - 0.5) / (BACK + 2)))
  return { ...cam, z: UP }
}

// now(서버 시계)에 아이리스 구멍 크기(0~1). 1은 다 열림, 0은 다 닫힘. 뒷모습 끝 IRIS_MS 동안 닫힘
export const irisOpen = (end: number, now: number) => Math.min(1, Math.max(0, (end - CARD_MS - now) / IRIS_MS))

// 칸. 마지막 쓰러짐을 보는 카메라는 그 사람이 바라보던 쪽 앞 위에서 발을 내려다보고, 보는 동안 조금씩 물러나며 올라감 (SHEEP-119의 장면을 다시 씀).
// 뒤로 넘어지면 머리가 화면 위쪽으로 감. ponytail: 임시 값
const FROM = { back: 2.4, up: 2.0 }
const TO = { back: 2.7, up: 2.3 }
// ms. 물러나며 올라가는 데 걸리는 시간. 위에서 보는 동안(약 4초)
const DRIFT_MS = 4000
// 칸. 내려다보는 점의 높이. 발목쯤이라 서 있을 때 모자까지, 누우면 몸 전체가 화면 가운데 줄에 듦
const AIM_UP = 0.2

// 마지막으로 쓰러지는 사람을 보는 카메라. x, y는 그 사람 발 자리(칸), facing은 쓰러질 때 바라보던 각도, elapsed는 보기 시작하고 지난 시간(ms)
export function lastFallCamera(x: number, y: number, facing: number, elapsed: number, fov: number): Camera {
  const u = Math.min(1, Math.max(0, elapsed / DRIFT_MS))
  const back = FROM.back + (TO.back - FROM.back) * u
  const up = FROM.up + (TO.up - FROM.up) * u
  const cam = makeCamera(x + Math.cos(facing) * back, y + Math.sin(facing) * back, facing + Math.PI, fov, -Math.atan((up - AIM_UP) / back))
  return { ...cam, z: up }
}
