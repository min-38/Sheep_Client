import { turn } from './turn.ts'

// 팔 흔들림의 진폭(라디안). ponytail: 임시 값(시스템 기획서 리볼버). 플레이해 보며 정함
export const SWAY_YAW = 0.02
export const SWAY_PITCH = 0.015

// 주기가 서로 나눠떨어지지 않는 사인 둘을 더해 같은 모양이 금방 되풀이되지 않게 함. 각 진폭의 절반이라 합이 진폭을 넘지 않음
const wave = (t: number, amp: number, p: number, q: number) =>
  (amp / 2) * (Math.sin((2 * Math.PI * t) / p) + Math.sin((2 * Math.PI * t) / q))

// 흔들림 배율. 돈 각도(라디안)마다 SCALE_RISE씩 올라 SCALE_MAX에서 멈추고, 가만히 있으면 SCALE_TAU(ms)마다
// 최저값과의 차이가 1/e로 줄어듦 (시스템 기획서 리볼버 흔들림 배율). ponytail: 임시 값. 플레이해 보며 정함
export const SCALE_MIN = 1
export const SCALE_MAX = 4
export const SCALE_RISE = 3
export const SCALE_TAU = 600
// 총을 든 채 돌 때 배율이 더 오르는 몫. ponytail: 임시 값. 플레이해 보며 정함
export const HELD_RISE = 1.5

// 마지막으로 돈 순간의 배율과 그 시각(ms). 그 뒤 값은 프레임마다 깎지 않고 필요할 때 지난 시간으로 구함
export type Unsteady = { scale: number; at: number }

export const steady: Unsteady = { scale: SCALE_MIN, at: 0 }

// t(ms)의 배율. 지수로 줄어 몇 번에 나눠 구해도 같은 값임
export const scaleAt = (u: Unsteady, t: number) => SCALE_MIN + (u.scale - SCALE_MIN) * Math.exp(-Math.max(0, t - u.at) / SCALE_TAU)

// t(ms)에 radians만큼 돈 뒤의 배율. px가 아니라 각도로 재 감도와 상관없음
// held면 총을 든 채(뽑는 중 포함) 돈 것이라 HELD_RISE배 더 오름. 권총집에 넣은 채 돌면 그대로임 (사용자 결정 2026-11-10, SHEEP-123)
export const afterTurn = (u: Unsteady, radians: number, t: number, held = false): Unsteady => ({
  scale: Math.min(SCALE_MAX, scaleAt(u, t) + SCALE_RISE * (held ? HELD_RISE : 1) * radians),
  at: Math.max(t, u.at),
})

// t(ms)에서의 흔들림에 배율 scale을 곱함. 정해진 식이라 같은 t면 같은 값임. 카메라는 흔들지 않고 총과 조준점만 흔듦
export function sway(t: number, scale = 1): { yaw: number; pitch: number } {
  return { yaw: scale * wave(t, SWAY_YAW, 1700, 2900), pitch: scale * wave(t, SWAY_PITCH, 2300, 3700) }
}

// 총알이 실제로 나가는 방향. 시선에 흔들림을 더하고 angle은 turn처럼 0 이상 2π 미만으로 묶음
export function aimAt(angle: number, pitch: number, t: number, scale = 1): { angle: number; pitch: number } {
  const s = sway(t, scale)
  return { angle: turn(angle, s.yaw, 1), pitch: pitch + s.pitch }
}

// 조준점이 화면 가운데에서 떨어질 거리(내부 해상도 px). proj는 투영면까지의 거리(px), pitch는 지금 시선.
// 화면을 위아래로 밀어 보여 주므로(y-shearing) 세로는 tan(pitch)의 차이로 잼. 그래야 서버가 tan으로 잰 광선 높이와 맞음
export function crosshairOffset(s: { yaw: number; pitch: number }, pitch: number, proj: number): { x: number; y: number } {
  return { x: proj * Math.tan(s.yaw), y: proj * (Math.tan(pitch) - Math.tan(pitch + s.pitch)) }
}
