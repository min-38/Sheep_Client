import { STEP_MS, STEPS, STEPS_FROM, TURN_MS, WALK_DURATION, type Schedule } from './round.ts'

// 등 돌리고 10걸음 동안의 긴장 연출 (사용자 결정 2026-11-10, SHEEP-141). 다 돌고 뜸을 들이기 시작할 때부터 심장이 점점 빨리 뛰다
// 마지막 걸음에서 멎고, 화면 가장자리는 박동마다 뛰며 점점 어두워져 "시작!"에 걷힘. 걸음마다 화면이 무겁게 내려앉음.
// 시각은 모두 서버 시계(ms)

// ms. 심장 박동 간격. 뜸을 들이기 시작할 때 BEAT_SLOW에서 마지막 걸음 때 BEAT_FAST로 고르게 빨라짐. ponytail: 임시 값. 들어 보고 정함
const BEAT_SLOW = 900
const BEAT_FAST = 420
// 가장자리 어둠. 처음 DARK_START에서 마지막 걸음 때 DARK_END까지 짙어지고, 박동마다 DARK_PULSE만큼 더 짙어졌다 PULSE_MS 동안 빠짐
const DARK_START = 0.25
const DARK_END = 0.85
const DARK_PULSE = 0.15
const PULSE_MS = 250

// 마지막(10번째) 걸음을 내딛는 시각
const lastStepAt = (walkAt: number) => walkAt + STEPS_FROM + (STEPS - 1) * STEP_MS

// 심장이 뛰는 시각들. 다 돌았을 때부터 마지막 걸음 전까지
export function heartbeats(walkAt: number): number[] {
  const start = walkAt + TURN_MS
  const end = lastStepAt(walkAt)
  const beats: number[] = []
  for (let t = start; t < end; t += BEAT_SLOW + (BEAT_FAST - BEAT_SLOW) * ((t - start) / (end - start))) beats.push(t)
  return beats
}

// now에 화면 가장자리 어둠(0~1). 다 돌기 전과 "시작!"부터는 0
export function darkness(s: Schedule, now: number): number {
  if (s.walk === undefined || now < s.walk + TURN_MS || (s.duel !== undefined && now >= s.duel)) return 0
  const start = s.walk + TURN_MS
  const p = Math.min((now - start) / (lastStepAt(s.walk) - start), 1)
  const last = heartbeats(s.walk).findLast((b) => b <= now)
  const pulse = last === undefined || p >= 1 ? 0 : Math.max(0, 1 - (now - last) / PULSE_MS)
  return Math.min(1, DARK_START + (DARK_END - DARK_START) * p + DARK_PULSE * pulse)
}

// now에 걸음 때문에 화면이 내려앉은 정도(dip, 0~1)와 기울어진 쪽(tilt, -1~1). 걸음을 디디면 STEP_MS의 5분의 1 동안 빨리 내려앉고
// 다음 걸음 전까지 천천히 올라옴. 디딘 발에 따라 좌우로 번갈아 기욺. 걷는 동안이 아니면 0
export function stepDip(walkAt: number, now: number): { dip: number; tilt: number } {
  const walked = now - walkAt - STEPS_FROM
  if (walked < 0 || walked >= WALK_DURATION) return { dip: 0, tilt: 0 }
  const u = (walked % STEP_MS) / STEP_MS
  const dip = u < 0.2 ? u / 0.2 : ((1 - u) / 0.8) ** 2
  return { dip, tilt: Math.floor(walked / STEP_MS) % 2 === 0 ? dip : -dip }
}
