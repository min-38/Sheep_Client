import { describe, expect, test } from 'vitest'
import { drawSmoke, smoke, SMOKE_MS } from './smoke.ts'

describe('smoke', () => {
  test('쏜 순간에는 첫 덩이만 총구 자리에 진하게 있음', () => {
    const [first, ...rest] = smoke(0)
    expect(rest).toEqual([])
    expect(first.rise).toBe(0)
    expect(first.drift).toBe(0)
    expect(first.ahead).toBe(0)
    expect(first.alpha).toBeGreaterThan(0.3)
  })

  test('쏘는 순간 앞으로 확 뿜었다가 느려짐. 먼저 나온 덩이일수록 멀리 감 (SHEEP-155)', () => {
    const at = (ms: number) => smoke(ms)[0].ahead
    expect(at(100)).toBeGreaterThan(0)
    expect(at(100) - at(0)).toBeGreaterThan(at(600) - at(500))
    const later = smoke(1000)
    expect(later[0].ahead).toBeGreaterThan(later[later.length - 1].ahead)
  })

  test('바람에 실려 모든 덩이가 같은 쪽(+)으로 흐름 (SHEEP-155)', () => {
    const late = smoke(2000)
    expect(late.length).toBeGreaterThan(0)
    expect(late.every((p) => p.drift > 0)).toBe(true)
  })

  test('예전(1.2초, 덩이 5개)보다 오래 남고 덩이가 많음 (SHEEP-155)', () => {
    expect(SMOKE_MS).toBeGreaterThan(2000)
    expect(smoke(400).length).toBeGreaterThan(5)
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
  // 칠한 네모의 가운데만 모음. toward는 겨눈 쪽 화면 자리
  function centers(elapsed: number, toward?: { x: number; y: number }) {
    const points: { x: number; y: number }[] = []
    const ctx = { fillStyle: '', fillRect: (x: number, y: number, w: number, h: number) => points.push({ x: x + w / 2, y: y + h / 2 }) }
    drawSmoke(ctx as unknown as CanvasRenderingContext2D, { x: 300, y: 200 }, elapsed, 100, toward)
    return points
  }

  test('1인칭 연기는 총구 화면 자리에서 위(화면 y가 작은 쪽)로 오름', () => {
    expect(centers(0).map((p) => p.y)).toEqual([200, 200])
    expect(Math.min(...centers(600).map((p) => p.y))).toBeLessThan(190)
    expect(centers(SMOKE_MS)).toEqual([])
  })

  test('겨눈 쪽을 주면 앞으로 뿜은 연기가 그쪽(화면 가운데)으로 나감 (SHEEP-155)', () => {
    const [still] = centers(150)
    const [blown] = centers(150, { x: 240, y: 135 })
    expect(blown.x).toBeLessThan(still.x)
  })
})
