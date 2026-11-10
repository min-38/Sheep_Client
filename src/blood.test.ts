import { describe, expect, test } from 'vitest'
import { BURST_MS, burst } from './blood.ts'

describe('burst', () => {
  test('맞은 순간에는 모든 조각이 맞은 자리에 진하게 있음', () => {
    const drops = burst(0)
    expect(drops.length).toBeGreaterThan(4)
    for (const d of drops) expect([d.out, d.side, d.up, d.alpha].map(Math.abs)).toEqual([0, 0, 0, 1])
  })

  test('조각은 몸 바깥쪽으로 퍼져 나가고, 처음엔 솟았다가 떨어지며 옅어짐', () => {
    const early = burst(80)
    const late = burst(400)
    for (const [i, d] of early.entries()) {
      expect(d.out).toBeGreaterThan(0)
      expect(late[i].out).toBeGreaterThan(d.out)
      expect(late[i].up).toBeLessThan(d.up)
      expect(late[i].alpha).toBeLessThan(d.alpha)
    }
    expect(new Set(early.map((d) => Math.sign(d.side))).size).toBeGreaterThan(1)
  })

  test('BURST_MS가 지나면 사라지고, 맞기 전에는 없음', () => {
    expect(burst(BURST_MS - 1).length).toBeGreaterThan(0)
    expect(burst(BURST_MS)).toEqual([])
    expect(burst(-1)).toEqual([])
  })
})
