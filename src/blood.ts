import type { Box } from './character.ts'

// 맞으면 튀는 피 (SHEEP-126). 맞은 자리에서 조각 몇 개가 몸 바깥쪽으로 부채꼴로 퍼지며 솟았다 떨어지고 옅어짐.
// 맞은 뒤 지난 시간만으로 정해, 결투 화면과 관전, 다시 보기가 같은 식을 씀

// ms. 피가 튀어 사라지기까지. ponytail: 임시 값. 화면을 보며 맞춤
export const BURST_MS = 450
const DROPS = 7
// 칸/ms. 바깥으로 나가는 빠르기와 처음 솟는 빠르기. 칸/ms²는 떨어지는 가속. 라디안은 부채꼴의 반 폭
const SPEED = 0.0016
const LIFT = 0.0012
const GRAVITY = 0.000009
const SPREAD = 0.9

// 조각 하나. out은 몸 바깥쪽(몸 가운데에서 맞은 자리 쪽)으로, side는 그 옆으로 간 거리(칸), up은 솟은 높이(칸, 떨어지면 음수), alpha는 진하기
export type Drop = { out: number; side: number; up: number; alpha: number }

// 맞은 뒤 elapsed(ms)의 조각들. 조각마다 나가는 쪽과 빠르기가 조금씩 다름
export function burst(elapsed: number): Drop[] {
  if (elapsed < 0 || elapsed >= BURST_MS) return []
  return Array.from({ length: DROPS }, (_, i) => {
    const a = ((i / (DROPS - 1)) * 2 - 1) * SPREAD
    const v = SPEED * (0.7 + 0.15 * (i % 3))
    const lift = LIFT * (1 + 0.5 * (i % 2))
    return { out: v * Math.cos(a) * elapsed, side: v * Math.sin(a) * elapsed, up: lift * elapsed - (GRAVITY * elapsed * elapsed) / 2, alpha: 1 - elapsed / BURST_MS }
  })
}

// 쓰러진 사람 밑에 천천히 번지는 피 웅덩이 (사용자 결정 2026-11-10, SHEEP-126). 쓰러진 몸의 상자에 납작한 상자로 더해 누운 몸이 웅덩이를 가림.
// 바닥에 닿은 뒤 지난 시간만으로 정함

// ms. 다 번지기까지. 처음엔 빨리, 갈수록 느리게 번짐. ponytail: 임시 값. 화면을 보며 맞춤
export const POOL_MS = 8000
// 블록. 다 번진 웅덩이의 반지름. 누운 사람 키(30블록)의 절반쯤이라 몸 밖으로 넉넉히 번져 보임
const POOL_RADIUS = 16
// 블록. 웅덩이 두께의 반. 모래 바로 위에 깔림
const POOL_HALF_UP = 0.05
// 웅덩이 색. 튀는 피보다 어두움
const POOL_RGB: Box['rgb'] = [95, 8, 8]
// 웅덩이를 이루는 네모들. off는 가운데에서 떨어진 거리, size는 반 변이고 둘 다 반지름 몫. dir은 놓인 방향, turn은 세로축으로 돌린 각(라디안).
// 겹쳐 놓아 둥글고 가장자리가 울퉁불퉁하게 보임
const PATCHES = [
  { off: 0, dir: 0, size: 0.7, turn: 0.3 },
  { off: 0.45, dir: 0.6, size: 0.55, turn: 1.1 },
  { off: 0.5, dir: 2.4, size: 0.5, turn: 0.2 },
  { off: 0.4, dir: 4.1, size: 0.6, turn: 0.9 },
  { off: 0.55, dir: 5.3, size: 0.45, turn: 0.5 },
]

// center는 웅덩이 가운데의 모델 좌표 [x, z](블록), elapsed는 바닥에 닿은 뒤 지난 시간(ms)
export function pool(center: readonly [number, number], elapsed: number): Box[] {
  if (elapsed <= 0) return []
  const r = POOL_RADIUS * (1 - (1 - Math.min(1, elapsed / POOL_MS)) ** 2)
  return PATCHES.map((p) => ({
    c: [center[0] + r * p.off * Math.cos(p.dir), POOL_HALF_UP, center[1] + r * p.off * Math.sin(p.dir)],
    axes: [
      [Math.cos(p.turn), 0, Math.sin(p.turn)],
      [0, 1, 0],
      [-Math.sin(p.turn), 0, Math.cos(p.turn)],
    ],
    half: [r * p.size, POOL_HALF_UP, r * p.size],
    rgb: POOL_RGB,
  }))
}
