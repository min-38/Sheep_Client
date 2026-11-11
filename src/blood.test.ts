import { describe, expect, test } from 'vitest'
import { bulletDir, BURST_MS, burst, exitPoint, pool, POOL_MS } from './blood.ts'
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

  test('대부분은 총알이 날아가던 쪽으로 튀고, 들어간 자리에서 쏜 사람 쪽(back)으로는 적게 덜 멀리 튐 (SHEEP-176)', () => {
    const drops = burst(300)
    const ahead = drops.filter((d) => !d.back)
    const back = drops.filter((d) => d.back)
    expect(back.length).toBeGreaterThan(0)
    expect(ahead.length).toBeGreaterThan(back.length)
    expect(Math.max(...back.map((d) => d.out))).toBeLessThan(Math.min(...ahead.map((d) => d.out)))
  })

  test('BURST_MS가 지나면 사라지고, 맞기 전에는 없음', () => {
    expect(burst(BURST_MS - 1).length).toBeGreaterThan(0)
    expect(burst(BURST_MS)).toEqual([])
    expect(burst(-1)).toEqual([])
  })
})

describe('exitPoint (SHEEP-176)', () => {
  test('총알이 원기둥 가운데를 지나면 맞은 자리의 반대쪽 겉면으로 나감', () => {
    const exit = exitPoint({ x: 1.15, y: 1 }, { x: 1, y: 1 }, { x: -1, y: 0 })
    expect(exit.x).toBeCloseTo(0.85)
    expect(exit.y).toBeCloseTo(1)
  })

  test('겉면을 스치면 맞은 자리에서 바로 나감', () => {
    const exit = exitPoint({ x: 1, y: 1.15 }, { x: 1, y: 1 }, { x: 1, y: 0 })
    expect(exit.x).toBeCloseTo(1)
    expect(exit.y).toBeCloseTo(1.15)
  })
})

describe('bulletDir (SHEEP-176)', () => {
  test('맞은 자리를 가장 가깝게 지나는 발사의 쪽을 고름', () => {
    // (0, 0)에서 +x로 쏜 발사가 (4, 0.05)를 맞힘. (0, 3)에서 +y로 쏜 발사는 그 자리를 지나지 않음
    const d = bulletDir([{ x: 0, y: 3, angle: Math.PI / 2 }, { x: 0, y: 0, angle: 0 }], { x: 4, y: 0.05 })
    expect(d?.x).toBeCloseTo(1)
    expect(d?.y).toBeCloseTo(0)
  })

  test('맞은 자리를 등지고 쏜 발사는 고르지 않고, 고를 발사가 없으면 null', () => {
    expect(bulletDir([{ x: 0, y: 0, angle: Math.PI }], { x: 4, y: 0 })).toBeNull()
    expect(bulletDir([], { x: 4, y: 0 })).toBeNull()
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
