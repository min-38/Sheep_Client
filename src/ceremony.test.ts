import { describe, expect, test } from 'vitest'
import { irisOpen, IRIS_MS, PAID_MS, paidShown, walkerAt, walkoffAt, walkoffCamera, WALKOFF_MS } from './ceremony.ts'
import { SUN_AZ } from './desert.ts'

const end = 100000
const SUN = (SUN_AZ * Math.PI) / 180

describe('walkoffAt', () => {
  test('받은 돈 자막(PAID_MS)과 걸어감(WALKOFF_MS) 앞부터 세레모니 시간을 셈. 그 전은 포스터라 null (SHEEP-136, SHEEP-150)', () => {
    const start = end - PAID_MS - WALKOFF_MS
    expect(walkoffAt(end, start - 1)).toBeNull()
    expect(walkoffAt(end, start)).toBe(0)
    expect(walkoffAt(end, end - 100)).toBe(PAID_MS + WALKOFF_MS - 100)
  })

  test('서버의 승리 결과 시간(10초) 안에 포스터 4초, 걸어감과 닫힘 4초, 받은 돈 자막 2초 (사용자 결정 2026-11-11, SHEEP-150 시안 C)', () => {
    expect(WALKOFF_MS).toBe(4000)
    expect(PAID_MS).toBe(2000)
    expect(10000 - WALKOFF_MS - PAID_MS).toBe(4000)
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
  test('받은 돈 자막 앞 IRIS_MS 동안 다 열린 데서 다 닫히고, 자막 동안은 닫혀 있음', () => {
    const closed = end - PAID_MS
    expect(irisOpen(end, closed - IRIS_MS - 1)).toBe(1)
    expect(irisOpen(end, closed - IRIS_MS / 2)).toBeCloseTo(0.5)
    expect(irisOpen(end, closed)).toBe(0)
    expect(irisOpen(end, end)).toBe(0)
  })
})

describe('paidShown (SHEEP-150)', () => {
  test('화면이 다 닫힌 뒤(걸어감이 끝난 뒤)에만 받은 돈 자막을 보임', () => {
    expect(paidShown(null)).toBe(false)
    expect(paidShown(WALKOFF_MS - 1)).toBe(false)
    expect(paidShown(WALKOFF_MS)).toBe(true)
  })
})
