import { describe, expect, test } from 'vitest'
import { entranceAt, ENTER_MS } from './entrance.ts'

const countdown = 50000

describe('entranceAt', () => {
  test('카운트다운 ENTER_MS 전부터 카운트다운 시각 전까지만 (사용자 결정 2026-11-10, SHEEP-137)', () => {
    expect(entranceAt(countdown, countdown - ENTER_MS - 1)).toBeNull()
    expect(entranceAt(countdown, countdown - ENTER_MS)).toEqual({ turn: 0, open: 0, push: 0 })
    expect(entranceAt(countdown, countdown)).toBeNull()
  })

  test('뒤돌고, 문이 열리고, 문 밖으로 나아가는 차례', () => {
    const at = (ms: number) => entranceAt(countdown, countdown - ENTER_MS + ms)!
    const turning = at(ENTER_MS * 0.2)
    expect(turning.turn).toBeGreaterThan(0)
    expect(turning.turn).toBeLessThan(1)
    expect(turning.open).toBe(0)
    const opening = at(ENTER_MS * 0.55)
    expect(opening.turn).toBe(1)
    expect(opening.open).toBeGreaterThan(0)
    expect(opening.push).toBe(0)
    const pushing = at(ENTER_MS - 1)
    expect(pushing.open).toBe(1)
    expect(pushing.push).toBeGreaterThan(0.99)
  })
})
