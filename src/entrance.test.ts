import { describe, expect, test } from 'vitest'
import { DOOR_ZOOM, entranceAt, entranceTrack, ENTER_MS, SWING_REST, swingAngle } from './entrance.ts'

const countdown = 50000
const at = (ms: number) => entranceAt(countdown, countdown - ENTER_MS + ms)!
// 문에 닿아 미는 때(ms). 그 전에는 pushed가 음수
const pushAt = Array.from({ length: ENTER_MS }, (_, ms) => ms).find((ms) => at(ms).pushed >= 0)!

describe('entranceAt', () => {
  test('카운트다운 ENTER_MS 전부터 카운트다운 시각 전까지만 (사용자 결정 2026-11-10, SHEEP-137)', () => {
    expect(entranceAt(countdown, countdown - ENTER_MS - 1)).toBeNull()
    expect(at(0)).toMatchObject({ turn: 0, zoom: 1, white: 0, arena: false })
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

  test('서버가 준비 뒤 카운트다운까지 두는 6초와 같음 (서버 RoundFlow.EnterDuration, 사용자 결정 2026-11-11, SHEEP-145)', () => {
    expect(ENTER_MS).toBe(6000)
  })

  test('문을 민 뒤 하얗게 번지고, 다 하얘진 뒤부터 결투장을 그려 천천히 드러냄 (SHEEP-145)', () => {
    expect(at(pushAt)).toMatchObject({ white: 0, arena: false })
    const frames = Array.from({ length: ENTER_MS / 50 }, (_, i) => at(i * 50))
    const firstArena = frames.findIndex((f) => f.arena)
    // 결투장은 다 하얘진 때부터만 그려, 술집에서 결투장으로 바뀌는 순간이 보이지 않음
    expect(firstArena).toBeGreaterThan(0)
    expect(frames[firstArena].white).toBe(1)
    // 하얀 화면은 1초 넘게 걸려 걷히고 카운트다운 전에 다 걷힘
    const cleared = frames.findIndex((f, i) => i > firstArena && f.white === 0)
    expect((cleared - firstArena) * 50).toBeGreaterThanOrEqual(1000)
    expect(at(ENTER_MS - 1)).toMatchObject({ white: 0, arena: true })
  })
})

describe('entranceTrack', () => {
  test('문을 밀기 전에는 술집 곡, 밀면 줄여 끄고, 결투장이 드러나면 결투 전 곡 (SHEEP-145)', () => {
    expect(entranceTrack(at(pushAt - 100))).toBe('saloon')
    expect(entranceTrack(at(pushAt + 100))).toBeNull()
    expect(entranceTrack(at(ENTER_MS - 100))).toBe('standoff')
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
