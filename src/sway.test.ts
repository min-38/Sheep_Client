import { describe, expect, test } from 'vitest'
import { aimAt, crosshairOffset, sway, SWAY_PITCH, SWAY_YAW } from './sway.ts'

const TAU = Math.PI * 2

describe('sway', () => {
  test('흔들림이 진폭을 넘지 않음', () => {
    for (let t = 0; t <= 20_000; t += 7) {
      const s = sway(t)
      expect(Math.abs(s.yaw)).toBeLessThanOrEqual(SWAY_YAW)
      expect(Math.abs(s.pitch)).toBeLessThanOrEqual(SWAY_PITCH)
    }
  })

  test('한 프레임(16ms) 사이에 진폭의 10%보다 적게 움직임', () => {
    for (let t = 0; t <= 20_000; t += 16) {
      const a = sway(t)
      const b = sway(t + 16)
      expect(Math.abs(b.yaw - a.yaw)).toBeLessThan(SWAY_YAW * 0.1)
      expect(Math.abs(b.pitch - a.pitch)).toBeLessThan(SWAY_PITCH * 0.1)
    }
  })

  test('같은 시각이면 같은 값', () => {
    expect(sway(1234)).toEqual(sway(1234))
  })
})

describe('aimAt', () => {
  test('흔들림을 더함', () => {
    const s = sway(500)
    const a = aimAt(1, 0.2, 500)
    expect(a.angle).toBeCloseTo(1 + s.yaw)
    expect(a.pitch).toBeCloseTo(0.2 + s.pitch)
  })

  test('2π 바로 아래에서 흔들려도 0 이상 2π 미만', () => {
    for (let t = 0; t <= 5000; t += 50) {
      const a = aimAt(TAU - 1e-6, 0, t)
      expect(a.angle).toBeGreaterThanOrEqual(0)
      expect(a.angle).toBeLessThan(TAU)
    }
  })
})

describe('crosshairOffset', () => {
  test('흔들림이 없으면 화면 가운데', () => {
    const o = crosshairOffset({ yaw: 0, pitch: 0 }, 0.3, 200)
    expect(o.x).toBe(0)
    expect(o.y).toBeCloseTo(0)
  })

  test('오른쪽으로 흔들리면 오른쪽, 위로 흔들리면 위', () => {
    expect(crosshairOffset({ yaw: 0.01, pitch: 0 }, 0, 200).x).toBeGreaterThan(0)
    expect(crosshairOffset({ yaw: 0, pitch: 0.01 }, 0, 200).y).toBeLessThan(0)
  })

  test('위를 보고 있으면 같은 흔들림도 화면에서 더 크게 움직임', () => {
    // 화면을 위아래로 밀어 보여 주므로(y-shearing) 광선 높이 tan(pitch)의 차이만큼 움직여야 서버 판정과 맞음
    const s = { yaw: 0, pitch: 0.01 }
    const level = crosshairOffset(s, 0, 200).y
    const up = crosshairOffset(s, 0.5, 200).y
    expect(up).toBeCloseTo(200 * (Math.tan(0.5) - Math.tan(0.51)))
    expect(Math.abs(up)).toBeGreaterThan(Math.abs(level))
  })
})
