import { turn } from './turn.ts'

// 팔 흔들림의 진폭(라디안). ponytail: 임시 값(시스템 기획서 리볼버). 플레이해 보며 정함
export const SWAY_YAW = 0.02
export const SWAY_PITCH = 0.015

// 주기가 서로 나눠떨어지지 않는 사인 둘을 더해 같은 모양이 금방 되풀이되지 않게 함. 각 진폭의 절반이라 합이 진폭을 넘지 않음
const wave = (t: number, amp: number, p: number, q: number) =>
  (amp / 2) * (Math.sin((2 * Math.PI * t) / p) + Math.sin((2 * Math.PI * t) / q))

// t(ms)에서의 흔들림. 정해진 식이라 같은 t면 같은 값임. 카메라는 흔들지 않고 총과 조준점만 흔듦
export function sway(t: number): { yaw: number; pitch: number } {
  return { yaw: wave(t, SWAY_YAW, 1700, 2900), pitch: wave(t, SWAY_PITCH, 2300, 3700) }
}

// 총알이 실제로 나가는 방향. 시선에 흔들림을 더하고 angle은 turn처럼 0 이상 2π 미만으로 묶음
export function aimAt(angle: number, pitch: number, t: number): { angle: number; pitch: number } {
  const s = sway(t)
  return { angle: turn(angle, s.yaw, 1), pitch: pitch + s.pitch }
}

// 조준점이 화면 가운데에서 떨어질 거리(내부 해상도 px). proj는 투영면까지의 거리(px), pitch는 지금 시선.
// 화면을 위아래로 밀어 보여 주므로(y-shearing) 세로는 tan(pitch)의 차이로 잼. 그래야 서버가 tan으로 잰 광선 높이와 맞음
export function crosshairOffset(s: { yaw: number; pitch: number }, pitch: number, proj: number): { x: number; y: number } {
  return { x: proj * Math.tan(s.yaw), y: proj * (Math.tan(pitch) - Math.tan(pitch + s.pitch)) }
}
