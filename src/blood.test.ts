import { describe, expect, test } from 'vitest'
import { BURST_MS, burst, pool, POOL_MS } from './blood.ts'
import type { Box } from './character.ts'

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

describe('pool', () => {
  const corners = (b: Box) => [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [-1, 1].map((k) => b.c.map((c, n) => c + b.axes[0][n] * i * b.half[0] + b.axes[1][n] * j * b.half[1] + b.axes[2][n] * k * b.half[2]))))
  const reach = (boxes: Box[]) => Math.max(0, ...boxes.flatMap(corners).map((p) => Math.hypot(p[0] - 3, p[2] + 2)))

  test('바닥에 닿기 전에는 웅덩이가 없음', () => {
    expect(pool([3, -2], 0)).toEqual([])
    expect(pool([3, -2], -100)).toEqual([])
  })

  test('가운데에서 천천히 번지다가 POOL_MS 뒤에는 그대로임', () => {
    const sizes = [200, 1000, POOL_MS / 2, POOL_MS, POOL_MS * 2].map((ms) => reach(pool([3, -2], ms)))
    for (let i = 1; i < 4; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
    expect(sizes[4]).toBeCloseTo(sizes[3])
    // 처음 1초에 다 번진 크기의 절반을 넘지 않음
    expect(sizes[1]).toBeLessThan(sizes[3] / 2)
  })

  test('모래 위에 납작하게 깔려 누운 몸에 가려짐', () => {
    for (const b of pool([3, -2], POOL_MS)) for (const p of corners(b)) expect(p[1]).toBeGreaterThanOrEqual(0)
    for (const b of pool([3, -2], POOL_MS)) for (const p of corners(b)) expect(p[1]).toBeLessThan(0.2)
  })
})
