import { describe, expect, test } from 'vitest'
import { orbit } from './backdrop.ts'

describe('orbit', () => {
  test('어느 방위에서도 가운데에서 radius만큼 떨어져 있음', () => {
    for (const phase of [0, 1, 2.5, -4, 20]) {
      const cam = orbit(10.5, 10.5, 4, phase)
      expect(Math.hypot(cam.x - 10.5, cam.y - 10.5)).toBeCloseTo(4)
    }
  })

  test('늘 가운데를 봄', () => {
    for (const phase of [0, 1, 2.5, -4, 20]) {
      const cam = orbit(10.5, 10.5, 4, phase)
      expect(cam.x + 4 * Math.cos(cam.angle)).toBeCloseTo(10.5)
      expect(cam.y + 4 * Math.sin(cam.angle)).toBeCloseTo(10.5)
    }
  })

  test('phase는 가운데에서 본 카메라의 방위', () => {
    const cam = orbit(10.5, 10.5, 4, Math.PI / 2)
    expect(cam.x).toBeCloseTo(10.5)
    expect(cam.y).toBeCloseTo(14.5)
  })
})
