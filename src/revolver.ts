import { castRay, type Grid } from './raycast.ts'

// 컨셉 기획서 규칙: 리볼버 6발, 재장전 없음
export const ROUNDS = 6

// lastShot은 마지막으로 쏜 시각(ms)
export type Revolver = { rounds: number; lastShot: number }

export const loaded = (rounds: number): Revolver => ({ rounds, lastShot: -Infinity })

// 남은 총알이 있고 발사 간격이 지났으면 한 발 쓴 리볼버를, 아니면 null을 돌려줌
export function pull(gun: Revolver, now: number, interval: number): Revolver | null {
  if (gun.rounds <= 0 || now - gun.lastShot < interval) return null
  return { rounds: gun.rounds - 1, lastShot: now }
}

// (x, y)에서 angle로 쏜 광선이 벽보다 먼저 닿는 첫 과녁의 번호. 없으면 -1.
// 과녁은 반지름 radius인 원. 위아래 조준이 없어 좌우 각도만 봄 (기술 설계서 명중 판정)
// ponytail: M2 혼자 쏘기용 클라 판정. 서버에 붙으면 서버가 판정하므로 그때 클라에서는 뺌
export function firstHit(grid: Grid, x: number, y: number, angle: number, targets: readonly { x: number; y: number }[], radius: number): number {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  // 길이 1인 광선이라 castRay의 dist가 곧 광선을 따라 잰 거리임
  let nearest = castRay(grid, x, y, dx, dy)?.dist ?? Infinity
  let hit = -1
  for (let i = 0; i < targets.length; i++) {
    const rx = targets[i].x - x
    const ry = targets[i].y - y
    // along: 광선 위에서 과녁 중심에 가장 가까운 점까지의 거리, off: 그 점에서 중심까지 거리의 제곱
    const along = rx * dx + ry * dy
    const off = rx * rx + ry * ry - along * along
    if (along <= 0 || off > radius * radius) continue
    // 원 둘레에 처음 닿는 거리
    const enter = along - Math.sqrt(radius * radius - off)
    if (enter < nearest) {
      nearest = enter
      hit = i
    }
  }
  return hit
}
