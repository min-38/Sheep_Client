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
