import type { Hand } from './settings.ts'

// 연습 (시스템 기획서 방 화면 연습, SHEEP-195). 혼자 결투장에 서서 과녁을 쏨. 판정은 서버에 보내지 않고 클라가 함

// 칸. 8인 판이 걷기를 마친 자리의 반지름. 서버 StartPlacement.Radius(1) + RoundFlow.WalkDistance(10걸음 × 0.3)
export const SPOT_RADIUS = 4
// 걷기를 마친 자리 수. 0번에 내가 서고 나머지에 과녁이 섬
const SPOTS = 8
// ms. 과녁의 상처와 사격 결과 카드의 구멍이 남는 시간
export const HOLE_MS = 5000

// (cx, cy)를 가운데로 한 걷기 끝 자리 여덟 곳. 모두 가운데를 봄. 각도는 서버 StartPlacement처럼 0이 +x, π/2가 +y
export function practiceSpots(cx: number, cy: number): { x: number; y: number; angle: number }[] {
  return Array.from({ length: SPOTS }, (_, i) => {
    const around = (2 * Math.PI * i) / SPOTS
    return { x: cx + SPOT_RADIUS * Math.cos(around), y: cy + SPOT_RADIUS * Math.sin(around), angle: around + Math.PI }
  })
}

// 과녁 일곱의 모습. 내 캐릭터를 뺀 캐릭터들이고, 사람 색은 캐릭터 번호와 같은 번호라 서로 겹치지 않음
export const targetLooks = (mine: number): { character: number; color: number; hand: Hand }[] =>
  Array.from({ length: SPOTS }, (_, character) => character).filter((c) => c !== mine).map((character) => ({ character, color: character, hand: 'right' }))

// 사격 결과 카드에 찍은 구멍 하나. target은 맞은 과녁, at은 쏜 시각(ms, 내 시계)
export type Hole = { target: string; offset: number; height: number; at: number }

// 구멍을 더함. 다른 과녁을 맞히면 카드를 비우고 그 과녁의 구멍부터 찍음
export const addHole = (holes: readonly Hole[], hole: Hole): Hole[] => (holes.length > 0 && holes[0].target !== hole.target ? [hole] : [...holes, hole])

// now(ms)에 남아 있는 구멍. 찍고 HOLE_MS가 지나면 사라짐
export const liveHoles = (holes: readonly Hole[], now: number): Hole[] => holes.filter((h) => now - h.at < HOLE_MS)
