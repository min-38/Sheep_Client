import { STEP_MS, STEPS, STEPS_FROM, TURN_MS, WALK_DURATION, type Schedule } from './round.ts'

// 등 돌리고 10걸음 동안의 긴장 연출 (사용자 결정 2026-11-10, SHEEP-141). 다 돌고 뜸을 들이기 시작할 때부터 화면 가장자리가
// 점점 어두워져 "시작!"에 걷히고, 걸음마다 화면이 무겁게 내려앉음. 심장 소리와 박동마다 뛰는 어둠은 발소리와 어울리지 않아 뺌 (SHEEP-147).
// 시각은 모두 서버 시계(ms)

// 가장자리 어둠. 처음 DARK_START에서 마지막 걸음 때 DARK_END까지 고르게 짙어짐. ponytail: 임시 값. 플레이해 보며 정함
const DARK_START = 0.25
const DARK_END = 0.85

// 마지막(10번째) 걸음을 내딛는 시각
const lastStepAt = (walkAt: number) => walkAt + STEPS_FROM + (STEPS - 1) * STEP_MS

// now에 화면 가장자리 어둠(0~1). 다 돌기 전과 "시작!"부터는 0. 마지막 걸음부터 "시작!"까지는 가장 짙은 채로 둠
export function darkness(s: Schedule, now: number): number {
  if (s.walk === undefined || now < s.walk + TURN_MS || (s.duel !== undefined && now >= s.duel)) return 0
  const start = s.walk + TURN_MS
  const p = Math.min((now - start) / (lastStepAt(s.walk) - start), 1)
  return DARK_START + (DARK_END - DARK_START) * p
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
