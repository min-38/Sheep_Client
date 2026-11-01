import { describe, expect, test } from 'vitest'
import { turn } from './turn.ts'

const TAU = Math.PI * 2

describe('turn', () => {
  test('오른쪽 이동량만큼 각도가 커짐', () => {
    expect(turn(0, 100, 0.01)).toBeCloseTo(1)
  })

  test('왼쪽으로 돌면 음수가 아니라 2π 근처 값이 됨', () => {
    expect(turn(0, -100, 0.01)).toBeCloseTo(TAU - 1)
  })

  test('여러 바퀴 돌아도 0~2π 안에 있음', () => {
    for (const dx of [10_000, -10_000, 123_456]) {
      const a = turn(1, dx, 0.01)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(TAU)
    }
  })

  test('움직이지 않으면 그대로', () => {
    expect(turn(2, 0, 0.01)).toBe(2)
  })
})
