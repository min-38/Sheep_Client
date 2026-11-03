import { describe, expect, test } from 'vitest'
import type { Grid } from './raycast.ts'
import { firstHit, loaded, pull } from './revolver.ts'

// 9×5, 테두리만 벽
const field: Grid = Array.from({ length: 5 }, (_, y) =>
  Array.from({ length: 9 }, (_, x) => (x === 0 || y === 0 || x === 8 || y === 4 ? 1 : 0)),
)
// field + x=4 세로 벽
const wall: Grid = field.map((row, y) => row.map((c, x) => (x === 4 && y > 0 && y < 4 ? 1 : c)))

const R = 0.25
// 쏘는 사람은 (1.5, 2.5)에서 +x를 봄
const shoot = (grid: Grid, targets: { x: number; y: number }[], angle = 0) => firstHit(grid, 1.5, 2.5, angle, targets, R)

describe('firstHit', () => {
  test('정면 과녁은 맞음', () => {
    expect(shoot(field, [{ x: 6.5, y: 2.5 }])).toBe(0)
  })

  test('반지름 안으로 스치면 맞고, 밖으로 비껴가면 빗나감', () => {
    expect(shoot(field, [{ x: 6.5, y: 2.5 + R * 0.9 }])).toBe(0)
    expect(shoot(field, [{ x: 6.5, y: 2.5 + R * 1.1 }])).toBe(-1)
  })

  test('일직선에 둘이면 가까운 쪽이 맞음', () => {
    expect(shoot(field, [{ x: 6.5, y: 2.5 }, { x: 3.5, y: 2.5 }])).toBe(1)
  })

  test('벽 뒤 과녁은 안 맞음', () => {
    expect(shoot(wall, [{ x: 6.5, y: 2.5 }])).toBe(-1)
    expect(shoot(wall, [{ x: 3.5, y: 2.5 }])).toBe(0)
  })

  test('등 뒤 과녁은 안 맞음', () => {
    expect(shoot(field, [{ x: 3.5, y: 2.5 }], Math.PI)).toBe(-1)
  })

  test('각도대로 날아감: 아래(+y)를 보면 아래 과녁이 맞음', () => {
    expect(firstHit(field, 4.5, 1.5, Math.PI / 2, [{ x: 4.5, y: 3.5 }, { x: 6.5, y: 1.5 }], R)).toBe(0)
  })

  test('과녁이 없으면 빗나감', () => {
    expect(shoot(field, [])).toBe(-1)
  })
})

describe('pull', () => {
  const INTERVAL = 300

  test('6발을 쏘면 더는 못 쏨', () => {
    let gun = loaded(6)
    for (let i = 1; i <= 6; i++) {
      const next = pull(gun, i * 1000, INTERVAL)
      expect(next?.rounds).toBe(6 - i)
      gun = next!
    }
    expect(pull(gun, 99_000, INTERVAL)).toBeNull()
  })

  test('발사 간격 안에는 못 쏘고, 간격이 지나면 쏨', () => {
    const gun = pull(loaded(6), 1000, INTERVAL)!
    expect(pull(gun, 1000 + INTERVAL - 1, INTERVAL)).toBeNull()
    expect(pull(gun, 1000 + INTERVAL, INTERVAL)).toEqual({ rounds: 4, lastShot: 1000 + INTERVAL })
  })

  test('장전한 직후 첫 발은 바로 쏨', () => {
    expect(pull(loaded(6), 0, INTERVAL)).toEqual({ rounds: 5, lastShot: 0 })
  })
})
