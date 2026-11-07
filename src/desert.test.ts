import { describe, expect, test } from 'vitest'
import { makeProps, timeOfDay } from './desert.ts'
import { HEIGHT } from './sprite.ts'

describe('timeOfDay', () => {
  test('5명 이상은 한낮', () => {
    expect(timeOfDay(5)).toBe('noon')
    expect(timeOfDay(8)).toBe('noon')
  })

  test('3~4명은 늦은 오후', () => {
    expect(timeOfDay(3)).toBe('afternoon')
    expect(timeOfDay(4)).toBe('afternoon')
  })

  test('2명 이하는 석양', () => {
    expect(timeOfDay(2)).toBe('sunset')
    expect(timeOfDay(1)).toBe('sunset')
    expect(timeOfDay(0)).toBe('sunset')
  })
})

describe('makeProps', () => {
  test('모든 소품이 걷는 범위(중심에서 4칸)에 걸치지 않음', () => {
    const props = makeProps(10.5, 10.5)
    expect(props.length).toBeGreaterThan(0)
    for (const p of props) {
      const f = p.frames[0]
      // 그림 폭의 절반만큼 더 떨어져야 그림 가장자리도 범위 밖임
      expect(Math.hypot(p.x - 10.5, p.y - 10.5) - (HEIGHT * f.w) / f.h / 2).toBeGreaterThan(4)
    }
  })

  test('8방향 모두 그림이 있음', () => {
    for (const p of makeProps(10.5, 10.5)) expect(p.frames).toHaveLength(8)
  })
})
