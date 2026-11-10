import { describe, expect, test } from 'vitest'
import { afterTurn, aimAt, crosshairOffset, HELD_RISE, SCALE_MAX, SCALE_MIN, SCALE_RISE, SCALE_TAU, scaleAt, steady, sway, SWAY_PITCH, SWAY_YAW } from './sway.ts'

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

  test('배율만큼 크게 흔들림', () => {
    const s = sway(500)
    const big = sway(500, 2.5)
    expect(big.yaw).toBeCloseTo(2.5 * s.yaw)
    expect(big.pitch).toBeCloseTo(2.5 * s.pitch)
  })
})

describe('aimAt', () => {
  test('흔들림을 더함', () => {
    const s = sway(500)
    const a = aimAt(1, 0.2, 500)
    expect(a.angle).toBeCloseTo(1 + s.yaw)
    expect(a.pitch).toBeCloseTo(0.2 + s.pitch)
  })

  test('배율을 곱한 흔들림을 더함', () => {
    const s = sway(500)
    const a = aimAt(1, 0.2, 500, 3)
    expect(a.angle).toBeCloseTo(1 + 3 * s.yaw)
    expect(a.pitch).toBeCloseTo(0.2 + 3 * s.pitch)
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

describe('흔들림 배율', () => {
  test('가만히 있으면 최저값', () => {
    expect(scaleAt(steady, 0)).toBe(SCALE_MIN)
    expect(scaleAt(steady, 99999)).toBe(SCALE_MIN)
  })

  test('돈 각도만큼 오름', () => {
    expect(scaleAt(afterTurn(steady, 0.2, 1000), 1000)).toBeCloseTo(SCALE_MIN + SCALE_RISE * 0.2)
    // 총을 든 채(뽑는 중 포함) 돌면 더 오르고, 권총집에 넣은 채면 그대로 (사용자 결정 2026-11-10, SHEEP-123)
    expect(HELD_RISE).toBeGreaterThan(1)
    expect(scaleAt(afterTurn(steady, 0.2, 1000, true), 1000)).toBeCloseTo(SCALE_MIN + SCALE_RISE * HELD_RISE * 0.2)
    expect(scaleAt(afterTurn(steady, 0.2, 1000, false), 1000)).toBeCloseTo(SCALE_MIN + SCALE_RISE * 0.2)
  })

  test('상한을 넘지 않음', () => {
    expect(scaleAt(afterTurn(steady, 10, 1000), 1000)).toBe(SCALE_MAX)
    const twice = afterTurn(afterTurn(steady, 10, 1000), 10, 1010)
    expect(scaleAt(twice, 1010)).toBe(SCALE_MAX)
  })

  test('가만히 있으면 τ마다 최저값과의 차이가 1/e로 줄어듦', () => {
    const u = afterTurn(steady, 0.5, 1000)
    const lift = scaleAt(u, 1000) - SCALE_MIN
    expect(scaleAt(u, 1000 + SCALE_TAU) - SCALE_MIN).toBeCloseTo(lift / Math.E)
    expect(scaleAt(u, 1000 + 20 * SCALE_TAU)).toBeCloseTo(SCALE_MIN)
  })

  test('시간을 몇 번에 나눠 계산해도 같은 값', () => {
    const u = afterTurn(steady, 0.5, 1000)
    // 돌지 않은 마우스 이벤트가 중간에 와도 줄어드는 곡선은 그대로임
    const split = afterTurn(afterTurn(u, 0, 1200), 0, 1500)
    expect(scaleAt(split, 1800)).toBeCloseTo(scaleAt(u, 1800))
  })

  test('줄어드는 중에 다시 돌면 그때 값에서 다시 오름', () => {
    const u = afterTurn(steady, 0.5, 1000)
    const again = afterTurn(u, 0.1, 1000 + SCALE_TAU)
    expect(scaleAt(again, 1000 + SCALE_TAU)).toBeCloseTo(scaleAt(u, 1000 + SCALE_TAU) + SCALE_RISE * 0.1)
  })

  test('마지막으로 돈 시각보다 이른 시각은 그 시각의 값', () => {
    const u = afterTurn(steady, 0.5, 1000)
    expect(scaleAt(u, 900)).toBe(scaleAt(u, 1000))
  })
})
