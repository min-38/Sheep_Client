import { describe, expect, test } from 'vitest'
import { loaded, pull } from './revolver.ts'

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
