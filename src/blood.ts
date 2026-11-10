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
