import { describe, expect, test } from 'vitest'
import { drawSmoke, smoke, SMOKE_MS } from './smoke.ts'

describe('smoke', () => {
  test('쏜 순간에는 첫 덩이만 총구 자리에 진하게 있음', () => {
    const [first, ...rest] = smoke(0)
    expect(rest).toEqual([])
    expect(first.rise).toBe(0)
    expect(first.drift).toBe(0)
    expect(first.alpha).toBeGreaterThan(0.3)
  })

  test('덩이는 차례로 나와 위로 올라가며 커지고 옅어짐', () => {
    expect(smoke(300).length).toBeGreaterThan(1)
    const [early] = smoke(100)
    const [late] = smoke(600)
    expect(late.rise).toBeGreaterThan(early.rise)
    expect(late.size).toBeGreaterThan(early.size)
    expect(late.alpha).toBeLessThan(early.alpha)
  })

  test('SMOKE_MS가 지나면 다 사라지고, 쏘기 전에는 없음', () => {
    expect(smoke(SMOKE_MS - 1).length).toBeGreaterThan(0)
    expect(smoke(SMOKE_MS)).toEqual([])
    expect(smoke(-1)).toEqual([])
  })
})

describe('drawSmoke', () => {
  // 칠한 네모의 가운데 y만 모음
  function centers(elapsed: number) {
    const ys: number[] = []
    const ctx = { fillStyle: '', fillRect: (_x: number, y: number, _w: number, h: number) => ys.push(y + h / 2) }
    drawSmoke(ctx as unknown as CanvasRenderingContext2D, { x: 300, y: 200 }, elapsed, 100)
    return ys
  }

  test('1인칭 연기는 총구 화면 자리에서 위(화면 y가 작은 쪽)로 오름', () => {
    expect(centers(0)).toEqual([200])
    expect(Math.min(...centers(600))).toBeLessThan(190)
    expect(centers(SMOKE_MS)).toEqual([])
  })
})
