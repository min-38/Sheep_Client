import { describe, expect, test } from 'vitest'
import { DOOR_ZOOM, entranceAt, ENTER_MS, SWING_REST, swingAngle } from './entrance.ts'

const countdown = 50000
const at = (ms: number) => entranceAt(countdown, countdown - ENTER_MS + ms)!
// 문에 닿아 미는 때(ms). 그 전에는 pushed가 음수
const pushAt = Array.from({ length: ENTER_MS }, (_, ms) => ms).find((ms) => at(ms).pushed >= 0)!

describe('entranceAt', () => {
  test('카운트다운 ENTER_MS 전부터 카운트다운 시각 전까지만 (사용자 결정 2026-11-10, SHEEP-137)', () => {
    expect(entranceAt(countdown, countdown - ENTER_MS - 1)).toBeNull()
    expect(at(0)).toMatchObject({ turn: 0, zoom: 1, white: 0 })
    expect(at(0).pushed).toBeLessThan(0)
    expect(entranceAt(countdown, countdown)).toBeNull()
  })

  test('다 돌 때까지는 다가가지 않음', () => {
    const turning = at(pushAt / 4)
    expect(turning.turn).toBeGreaterThan(0)
    expect(turning.turn).toBeLessThan(1)
    expect(turning.zoom).toBe(1)
  })

  test('다 돈 뒤에는 멈추지 않고 걸어가 문에 닿는 때 밂 (시안 A, 사용자 결정 2026-11-11, SHEEP-144)', () => {
    // 문 앞에서 서지 않음: 문을 밀기 전후로 화면이 쉬지 않고 커짐
    let before = at(pushAt - 200).zoom
    expect(at(pushAt - 200).turn).toBe(1)
    for (let ms = pushAt - 150; ms <= pushAt + 600; ms += 50) {
      expect(at(ms).zoom).toBeGreaterThan(before)
      before = at(ms).zoom
    }
    // 문에 닿는 때 화면 크기가 DOOR_ZOOM
    expect(at(pushAt).zoom).toBeCloseTo(DOOR_ZOOM, 1)
  })

  test('문을 민 뒤에 하얗게 번지기 시작해 끝에는 다 하얌', () => {
    expect(at(pushAt).white).toBe(0)
    expect(at(ENTER_MS - 1).white).toBeGreaterThan(0.99)
  })
})

describe('swingAngle', () => {
  test('밀기 전에는 닫혀 있음', () => {
    expect(swingAngle(-100)).toBe(0)
    expect(swingAngle(0)).toBe(0)
  })

  test('쾅 밀려 멈출 각도를 지나쳤다가 되돌아오며 떨다 멈춤', () => {
    const angles = Array.from({ length: 200 }, (_, i) => swingAngle(i * 10))
    const peak = Math.max(...angles)
    expect(peak).toBeGreaterThan(SWING_REST + 10)
    // 가장 크게 젖혀진 뒤 멈출 각도 아래로 한 번은 되돌아옴
    expect(Math.min(...angles.slice(angles.indexOf(peak)))).toBeLessThan(SWING_REST)
    // 2초 뒤에는 거의 멈춤
    expect(Math.abs(swingAngle(2000) - SWING_REST)).toBeLessThan(1)
  })
})
