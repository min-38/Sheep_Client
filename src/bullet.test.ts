import { describe, expect, test } from 'vitest'
import { along, BULLET_SPEED, bulletDots, bulletRange, EYE_HEIGHT, firstHit, type Point, type Ray } from './bullet.ts'
import { BODY, HEAD } from './hitcard.ts'

// 원점에서 +x로 수평하게 쏨. 총구 높이는 0.7칸
const flat: Ray = { x: 0, y: 0, z: 0.7, angle: 0, pitch: 0 }

describe('bulletRange', () => {
  test('아무것도 없으면 벽까지', () => {
    expect(bulletRange(flat, 12, [])).toBe(12)
  })

  test('앞에 선 사람의 몸 원기둥 겉에서 멈춤', () => {
    // 몸 높이(0.78 아래)로 날아가 원기둥 반지름 앞에서 닿음
    expect(bulletRange({ ...flat, z: 0.5 }, 20, [{ x: 5, y: 0 }])).toBeCloseTo(5 - BODY.radius, 9)
  })

  test('몸 위로 날아가면 더 가는 머리 원기둥에서 멈추고, 머리 위로 날아가면 지나감', () => {
    expect(bulletRange({ ...flat, z: 0.85 }, 20, [{ x: 5, y: 0 }])).toBeCloseTo(5 - HEAD.radius, 9)
    expect(bulletRange({ ...flat, z: HEAD.top + 0.05 }, 20, [{ x: 5, y: 0 }])).toBe(20)
  })

  test('옆으로 비켜선 사람과 뒤에 선 사람은 지나감', () => {
    expect(bulletRange(flat, 20, [{ x: 5, y: BODY.radius + 0.01 }, { x: -3, y: 0 }])).toBe(20)
  })

  test('아래로 쏘면 바닥에 닿는 데서 멈춤', () => {
    expect(bulletRange({ ...flat, pitch: -Math.atan(0.7 / 7) }, 20, [])).toBeCloseTo(7, 9)
  })
})

describe('firstHit', () => {
  // 눈높이에서 +x로 수평하게 쏨. 서버 HitScan과 같은 판정
  const eye: Ray = { ...flat, z: EYE_HEIGHT }

  test('눈높이로 수평하게 쏘면 머리. 맞은 높이와 자리는 원기둥 겉', () => {
    expect(firstHit(eye, 20, [{ x: 5, y: 0 }])).toEqual({ index: 0, zone: 'head', distance: expect.closeTo(5 - HEAD.radius, 9), height: expect.closeTo(EYE_HEIGHT, 9), offset: expect.closeTo(0, 9), x: expect.closeTo(5 - HEAD.radius, 9), y: expect.closeTo(0, 9) })
  })

  test('몸 높이로 쏘면 몸', () => {
    expect(firstHit({ ...eye, z: 0.5 }, 20, [{ x: 5, y: 0 }])?.zone).toBe('body')
  })

  test('offset은 맞은 자리가 그 사람 중심에서 쏜 사람 기준 오른쪽으로 떨어진 거리. +x를 볼 때 오른쪽은 +y', () => {
    // 사람이 오른쪽(+y)으로 0.1 비켜서 있으면 광선은 그 중심의 왼쪽을 지남
    expect(firstHit({ ...eye, z: 0.5 }, 20, [{ x: 5, y: 0.1 }])?.offset).toBeCloseTo(-0.1, 9)
  })

  test('가장 가까운 사람이 맞음. 벽보다 먼 사람과 비켜선 사람은 안 맞음', () => {
    expect(firstHit(eye, 20, [{ x: 8, y: 0 }, { x: 4, y: 0 }])?.index).toBe(1)
    expect(firstHit(eye, 3, [{ x: 5, y: 0 }])).toBeNull()
    expect(firstHit(eye, 20, [{ x: 5, y: BODY.radius + 0.01 }, { x: -3, y: 0 }])).toBeNull()
  })
})

describe('along', () => {
  test('광선 위 수평 거리의 점. 위로 쏘면 높이가 오름', () => {
    expect(along({ ...flat, angle: Math.PI / 2, pitch: Math.atan(0.1) }, 2)).toEqual({ x: expect.closeTo(0, 9), y: 2, z: expect.closeTo(0.9, 9) })
  })
})

describe('bulletDots', () => {
  const from: Point = { x: 0, y: 0, z: 0.7 }
  const to: Point = { x: 10, y: 0, z: 0.7 }

  test('쏜 순간에는 총구에 한 점', () => {
    expect(bulletDots(from, to, 0)).toEqual([{ x: 0, y: 0, z: 0.7, alpha: 1 }])
  })

  test('탄속대로 닿는 곳 쪽으로 가고, 뒤에 옅어지는 잔상이 따라옴', () => {
    const dots = bulletDots(from, to, 40)
    expect(dots[0].x).toBeCloseTo(BULLET_SPEED * 40, 9)
    expect(dots.length).toBeGreaterThan(2)
    for (let i = 1; i < dots.length; i++) {
      expect(dots[i].x).toBeLessThan(dots[i - 1].x)
      expect(dots[i].alpha).toBeLessThan(dots[i - 1].alpha)
    }
  })

  test('닿는 곳을 지난 점은 그리지 않고, 다 지나가면 사라짐', () => {
    const t = 10 / BULLET_SPEED + 1
    expect(bulletDots(from, to, t).every((d) => d.x <= 10)).toBe(true)
    expect(bulletDots(from, to, t + 1000)).toEqual([])
  })

  test('총구와 닿는 곳의 높이가 다르면 점도 그 사이로 오르내림', () => {
    const [head] = bulletDots(from, { x: 10, y: 0, z: 0.9 }, 40)
    expect(head.z).toBeGreaterThan(0.7)
    expect(head.z).toBeLessThan(0.9)
  })
})
