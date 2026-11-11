import { describe, expect, test } from 'vitest'
import { makeProps, SUN_AZ, SUN_HALF, timeOfDay, TOWN } from './desert.ts'
import { PX_PER_CELL } from './sprite.ts'

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
      expect(Math.hypot(p.x - 10.5, p.y - 10.5) - f.w / PX_PER_CELL / 2).toBeGreaterThan(4)
    }
  })

  test('8방향 모두 그림이 있음', () => {
    for (const p of makeProps(10.5, 10.5)) expect(p.frames).toHaveLength(8)
  })

  // 1칸 = 2 m로 실제 크기에 가깝게: 사와로 선인장 5.4 m, 바위 3.6 m 덩이, 회전초 1.8 m 덤불 그림 (SHEEP-163). 소품은 선인장, 바위, 회전초 차례로 돎
  test('선인장은 사람 키의 3배, 바위는 2배, 회전초는 사람 키만 한 그림', () => {
    const cells = makeProps(10.5, 10.5).map((p) => p.frames[0].h / PX_PER_CELL)
    expect(cells[0]).toBeCloseTo(2.7, 1)
    expect(cells[1]).toBeCloseTo(1.8, 1)
    expect(cells[2]).toBeCloseTo(0.9, 1)
  })
})

describe('TOWN', () => {
  const blocks = [...TOWN.lit, ...TOWN.shade]
  const DEG = Math.PI / 180
  // 480px 폭, 시야 66°에서 화면 가운데 1px의 tan 폭. 가운데가 가장 넓어 이보다 크면 어디서든 1px 이상임
  const PX = Math.tan(33 * DEG) / 240

  test('모든 덩어리가 지평선 위에 있음', () => {
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) {
      expect(b.bottom).toBeGreaterThanOrEqual(0)
      expect(b.top).toBeGreaterThan(b.bottom)
    }
  })

  test('해 방위에 걸치지 않음', () => {
    for (const b of blocks) {
      const d = Math.abs(b.az - SUN_AZ * DEG) % (2 * Math.PI)
      expect(Math.min(d, 2 * Math.PI - d)).toBeGreaterThanOrEqual(b.half + SUN_HALF * DEG)
    }
  })

  test('가는 다리와 날개도 화면에서 가로세로 1px 이상', () => {
    for (const b of blocks) {
      expect(2 * b.half).toBeGreaterThanOrEqual(Math.atan(PX))
      expect(b.top - b.bottom).toBeGreaterThanOrEqual(PX)
    }
  })
})
