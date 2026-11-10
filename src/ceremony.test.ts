import { describe, expect, test } from 'vitest'
import { irisOpen, IRIS_MS, walkerAt, walkoffAt, walkoffCamera, WALKOFF_MS } from './ceremony.ts'
import { SUN_AZ } from './desert.ts'

const end = 100000
const SUN = (SUN_AZ * Math.PI) / 180

describe('walkoffAt', () => {
  test('끝나기 WALKOFF_MS 전부터 세레모니 시간을 셈. 그 전은 포스터라 null (사용자 결정 2026-11-10, SHEEP-136)', () => {
    expect(walkoffAt(end, end - WALKOFF_MS - 1)).toBeNull()
    expect(walkoffAt(end, end - WALKOFF_MS)).toBe(0)
    expect(walkoffAt(end, end - 100)).toBe(WALKOFF_MS - 100)
  })

  test('서버의 승리 결과 시간(8.5초) 안에 포스터를 보일 틈이 남음', () => {
    expect(WALKOFF_MS).toBeLessThanOrEqual(8500 - 3000)
  })
})

describe('walkerAt', () => {
  test('해 쪽을 보고 해 쪽으로 걸어감', () => {
    const at0 = walkerAt(10, 10, 0)
    const later = walkerAt(10, 10, 2000)
    expect(at0).toEqual({ x: 10, y: 10, facing: SUN })
    const moved = Math.hypot(later.x - 10, later.y - 10)
    expect(moved).toBeGreaterThan(0.5)
    expect(Math.atan2(later.y - 10, later.x - 10)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
  })
})

describe('walkoffCamera', () => {
  test('이긴 사람 뒤에서 해 쪽을 봄', () => {
    const cam = walkoffCamera(10, 10, 66)
    expect(Math.atan2(cam.dirY, cam.dirX)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
    // 이긴 사람이 카메라 앞에 있음
    expect((10 - cam.x) * cam.dirX + (10 - cam.y) * cam.dirY).toBeGreaterThan(1)
  })
})

describe('irisOpen', () => {
  test('마지막 IRIS_MS 동안 다 열린 데서 다 닫힘', () => {
    expect(irisOpen(end, end - IRIS_MS - 1)).toBe(1)
    expect(irisOpen(end, end - IRIS_MS / 2)).toBeCloseTo(0.5)
    expect(irisOpen(end, end)).toBe(0)
    expect(irisOpen(end, end + 500)).toBe(0)
  })
})
