// 총구 연기 (SHEEP-124, 시스템 기획서 HUD 발사 불꽃). 쏜 뒤 덩이 몇 개가 차례로 나와 위로 피어오르며 커지고 옅어짐.
// 서부 영화 총격처럼 쏘는 순간 앞으로 확 뿜었다가 느려지고, 바람에 한쪽으로 흐르며 오래 남음 (사용자 플레이테스트 2026-11-11, SHEEP-155).
// 모양은 쏜 뒤 지난 시간만으로 정해, 내 화면과 다른 사람, 관전, 다시 보기가 같은 식을 씀

// ms. 쏜 뒤 연기가 보이는 시간. ponytail: 임시 값. 플레이해 보며 정함
export const SMOKE_MS = 2600
// 덩이 수와 나오는 간격(ms)
const PUFFS = 9
const GAP = 35
const LIFE = SMOKE_MS - GAP * (PUFFS - 1)
// 칸. 덩이가 다 올라간 높이, 덩이마다 옆으로 흔들리는 폭, 바람에 다 같이 흐르는 거리, 처음과 끝의 한 변. 처음 불투명도.
// ponytail: 화면을 보며 맞출 값
const RISE = 0.5
const DRIFT = 0.08
const WIND = 0.25
const SIZE: readonly [number, number] = [0.05, 0.3]
const ALPHA = 0.7
// 칸, ms. 첫 덩이가 앞으로 뿜는 거리와, 그 거리의 63%를 가는 시간. 뒤에 나온 덩이일수록 덜 감
const BLAST = 0.5
const BLAST_MS = 180

// 총구에서 본 덩이 하나. ahead는 쏜 쪽 앞으로, rise는 위로, drift는 오른쪽으로 간 거리(칸), size는 한 변(칸), alpha는 불투명도(0~1)
export type Puff = { ahead: number; rise: number; drift: number; size: number; alpha: number }

// 쏜 뒤 elapsed(ms)의 덩이들. 먼저 나온 것부터. 덩이마다 옆으로 흔들리는 쪽이 달라 한 줄로 서지 않음
export function smoke(elapsed: number): Puff[] {
  const puffs: Puff[] = []
  for (let i = 0; i < PUFFS; i++) {
    const age = elapsed - i * GAP
    const u = age / LIFE
    if (u < 0 || u >= 1) continue
    puffs.push({
      ahead: BLAST * (1 - i / PUFFS) * (1 - Math.exp(-age / BLAST_MS)),
      rise: RISE * (1 - (1 - u) ** 2),
      drift: DRIFT * Math.sin(i * 2.4) * u + WIND * u * u,
      // 처음에 빨리 부풀고 점점 느리게 커짐
      size: SIZE[0] + (SIZE[1] - SIZE[0]) * Math.sqrt(u),
      alpha: ALPHA * (1 - u),
    })
  }
  return puffs
}

// 덩이 둘레에 덧칠하는 옅은 테두리의 크기(배)와 불투명도(배). 네모 가장자리가 덜 딱딱해 보임
export const HALO_SIZE = 1.5
export const HALO_ALPHA = 0.35

// 1인칭 연기에서 1칸의 px(게임 캔버스 480×270). ponytail: 화면을 보며 맞출 값
export const SMOKE_PX = 200
// 1인칭에서 앞으로 뿜은 거리를 화면에 옮길 때 줄이는 몫. 앞으로 갈수록 화면 안쪽(겨눈 쪽)으로 모여 짧아 보임
const AHEAD_ON_SCREEN = 0.6

// 1인칭 연기. muzzle은 drawGun이 돌려준 총구의 화면 자리(px), scale은 1칸의 px, toward는 겨눈 쪽 화면 자리(없으면 앞으로 뿜지 않음)
export function drawSmoke(ctx: CanvasRenderingContext2D, muzzle: { x: number; y: number }, elapsed: number, scale: number, toward?: { x: number; y: number }) {
  const dx = toward ? toward.x - muzzle.x : 0
  const dy = toward ? toward.y - muzzle.y : 0
  const length = Math.hypot(dx, dy) || 1
  for (const p of smoke(elapsed)) {
    const forward = p.ahead * scale * AHEAD_ON_SCREEN
    const x = muzzle.x + p.drift * scale + (dx / length) * forward
    const y = muzzle.y - p.rise * scale + (dy / length) * forward
    for (const [grow, fade] of [
      [HALO_SIZE, HALO_ALPHA],
      [1, 1],
    ]) {
      const s = p.size * scale * grow
      ctx.fillStyle = `rgb(225 225 220 / ${p.alpha * fade})`
      ctx.fillRect(x - s / 2, y - s / 2, s, s)
    }
  }
}
