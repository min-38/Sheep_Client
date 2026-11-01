import { describe, expect, test } from 'vitest'
import { castRay, type Grid } from './raycast.ts'

// 7×7, 테두리만 벽
const box: Grid = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
]

// box + x=4 세로 벽
const wall: Grid = box.map((row, y) => row.map((c, x) => (x === 4 && y > 0 && y < 6 ? 1 : c)))

describe('castRay', () => {
  test('+x 방향은 오른쪽 테두리 벽에 닿음', () => {
    expect(castRay(box, 1.5, 3.5, 1, 0)).toEqual({ mapX: 6, mapY: 3, side: 0, dist: 4.5 })
  })

  test('-y 방향은 위쪽 테두리 벽에 닿음', () => {
    expect(castRay(box, 1.5, 3.5, 0, -1)).toEqual({ mapX: 1, mapY: 0, side: 1, dist: 2.5 })
  })

  test('중간 벽이 테두리보다 먼저 닿음', () => {
    expect(castRay(wall, 1.5, 3.5, 1, 0)).toEqual({ mapX: 4, mapY: 3, side: 0, dist: 2.5 })
  })

  test('평평한 벽은 화면 어느 열에서 봐도 수직 거리가 같음 (어안 없음)', () => {
    for (const camX of [-1, -0.5, 0, 0.5, 1]) {
      const hit = castRay(wall, 1.5, 3.5, 1, 0.66 * camX)
      expect(hit?.mapX).toBe(4)
      expect(hit?.dist).toBeCloseTo(2.5)
    }
  })

  test('벽 없이 격자를 벗어나면 null', () => {
    expect(castRay([[0, 0], [0, 0]], 0.5, 0.5, 1, 0)).toBeNull()
  })
})
