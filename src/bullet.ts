import { BODY, HEAD } from './hitcard.ts'

// 날아가는 총알 (SHEEP-125). 판정은 서버의 히트스캔 그대로 두고, 총구에서 닿는 곳까지 탄속대로 날아가는 점과 잔상을 보이기만 함.
// 닿는 곳은 서버처럼 쏜 사람 가운데의 눈높이에서 나간 광선으로 정하고, 총알은 총구에서 그곳까지 곧게 날아감.
// 총구는 몸 가운데에서 옆으로 비켜 있어, 총구에서 광선을 쏘면 서버가 머리를 맞혔다고 해도 옆으로 비껴가 보임

// 칸/ms. 리볼버 총알 약 250m/s, 1칸을 약 2m로 셈. 결투 거리(8~12칸)를 0.1초 안팎에 날아감
export const BULLET_SPEED = 0.125
// 칸. 아무것에도 닿지 않을 때 그리는 가장 먼 수평 거리
const MAX_RANGE = 40
// 칸. 잔상 점 사이 간격과 머리 뒤 잔상 수. 결투 거리에서 점이 이어져 한 줄기로 보이게 촘촘히 둠. ponytail: 화면을 보며 맞출 값
const TRAIL_GAP = 0.06
const TRAIL = 10
// ms. 쏜 뒤 총알이 가장 멀리 날아가 잔상까지 사라지는 시간. 이 뒤로는 그릴 것이 없음
export const FLIGHT_MS = (MAX_RANGE + TRAIL * TRAIL_GAP) / BULLET_SPEED

// 칸. 쏜 사람 눈높이. 서버 HitScan.EyeHeight와 같아야 함
export const EYE_HEIGHT = 0.5

// 격자 좌표와 높이(칸)
export type Point = { x: number; y: number; z: number }
// 판정 광선. x·y는 쏜 사람 자리, z는 눈높이, angle과 pitch는 shot의 쏜 각도와 위아래 각도
export type Ray = Point & { angle: number; pitch: number }
// 그릴 점 하나. alpha는 진하기(머리 1, 잔상은 뒤로 갈수록 옅음)
export type Dot = Point & { alpha: number }

// 광선 위 수평 거리 d의 점
export const along = (r: Ray, d: number): Point => ({ x: r.x + Math.cos(r.angle) * d, y: r.y + Math.sin(r.angle) * d, z: r.z + Math.tan(r.pitch) * d })

// 총알이 가는 수평 거리(칸). 벽까지의 거리 wall, 바닥, 서 있는 사람 people의 몸·머리 원기둥 중 가장 먼저 닿는 곳.
// 서버 판정(HitScan)과 같은 모양이지만 보이기만 하므로, 맞았는지는 서버가 알려 준 대로 따로 보임.
// ponytail: 원기둥 옆면으로만 들어가는 것을 봄. 위에서 떨어져 머리 윗면으로 들어가는 총알은 지나감. 위아래 조준이 ±0.5라 거의 없음
export function bulletRange(r: Ray, wall: number, people: readonly { x: number; y: number }[]): number {
  const dx = Math.cos(r.angle)
  const dy = Math.sin(r.angle)
  const slope = Math.tan(r.pitch)
  let range = Math.min(wall, MAX_RANGE)
  if (slope < 0) range = Math.min(range, r.z / -slope)
  for (const p of people) {
    const vx = p.x - r.x
    const vy = p.y - r.y
    const along = vx * dx + vy * dy
    const off2 = vx * vx + vy * vy - along * along
    for (const [radius, bottom, top] of [[BODY.radius, 0, BODY.top], [HEAD.radius, BODY.top, HEAD.top]]) {
      if (off2 > radius * radius) continue
      const d = along - Math.sqrt(radius * radius - off2)
      const z = r.z + slope * d
      if (d > 0 && z >= bottom && z <= top) range = Math.min(range, d)
    }
  }
  return range
}

// 쏜 뒤 elapsed(ms)에 from(총구)에서 to(닿는 곳)로 날아가는 점들. [0]이 머리이고 뒤로 잔상. to를 지난 점은 빼고, 다 지나가면 빈 배열
export function bulletDots(from: Point, to: Point, elapsed: number): Dot[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
  const head = BULLET_SPEED * Math.max(0, elapsed)
  const dots: Dot[] = []
  for (let k = 0; k <= TRAIL; k++) {
    const d = head - k * TRAIL_GAP
    if (d < 0) break
    if (d > length) continue
    const u = length === 0 ? 0 : d / length
    dots.push({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u, z: from.z + (to.z - from.z) * u, alpha: 1 - k / (TRAIL + 1) })
  }
  return dots
}
