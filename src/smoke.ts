// 총구 연기 (SHEEP-124, 시스템 기획서 HUD 발사 불꽃). 쏜 뒤 덩이 몇 개가 차례로 나와 위로 피어오르며 커지고 옅어짐.
// 모양은 쏜 뒤 지난 시간만으로 정해, 내 화면과 다른 사람, 관전, 다시 보기가 같은 식을 씀

// ms. 쏜 뒤 연기가 보이는 시간. ponytail: 임시 값. 플레이해 보며 정함
export const SMOKE_MS = 1200
// 덩이 수와 나오는 간격(ms)
const PUFFS = 5
const GAP = 50
const LIFE = SMOKE_MS - GAP * (PUFFS - 1)
// 칸. 덩이가 다 올라간 높이, 옆으로 흐르는 폭, 처음과 끝의 한 변. 처음 불투명도. ponytail: 화면을 보며 맞출 값
const RISE = 0.35
const DRIFT = 0.06
const SIZE: readonly [number, number] = [0.04, 0.16]
const ALPHA = 0.6

// 총구에서 본 덩이 하나. rise는 위로, drift는 옆으로 간 거리(칸), size는 한 변(칸), alpha는 불투명도(0~1)
export type Puff = { rise: number; drift: number; size: number; alpha: number }

// 쏜 뒤 elapsed(ms)의 덩이들. 먼저 나온 것부터. 덩이마다 옆으로 흐르는 쪽이 달라 한 줄로 서지 않음
export function smoke(elapsed: number): Puff[] {
  const puffs: Puff[] = []
  for (let i = 0; i < PUFFS; i++) {
    const u = (elapsed - i * GAP) / LIFE
    if (u < 0 || u >= 1) continue
    puffs.push({ rise: RISE * (1 - (1 - u) ** 2), drift: DRIFT * Math.sin(i * 2.4) * u, size: SIZE[0] + (SIZE[1] - SIZE[0]) * u, alpha: ALPHA * (1 - u) })
  }
  return puffs
}

// 1인칭 연기에서 1칸의 px(게임 캔버스 480×270). ponytail: 화면을 보며 맞출 값
export const SMOKE_PX = 200

// 1인칭 연기. muzzle은 drawGun이 돌려준 총구의 화면 자리(px), scale은 1칸의 px
export function drawSmoke(ctx: CanvasRenderingContext2D, muzzle: { x: number; y: number }, elapsed: number, scale: number) {
  for (const p of smoke(elapsed)) {
    const s = p.size * scale
    ctx.fillStyle = `rgb(225 225 220 / ${p.alpha})`
    ctx.fillRect(muzzle.x + p.drift * scale - s / 2, muzzle.y - p.rise * scale - s / 2, s, s)
  }
}
