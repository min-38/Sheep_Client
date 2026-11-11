import { describe, expect, test } from 'vitest'
import { addHole, HOLE_MS, liveHoles, practiceSpots, SPOT_RADIUS, targetLooks, type Hole } from './practice.ts'

describe('practiceSpots', () => {
  const spots = practiceSpots(10.5, 10.5)

  test('8인 판이 걷기를 마친 자리 여덟 곳. 모두 가운데에서 4칸이고 가운데를 봄', () => {
    expect(spots).toHaveLength(8)
    for (const s of spots) {
      expect(Math.hypot(s.x - 10.5, s.y - 10.5)).toBeCloseTo(SPOT_RADIUS, 9)
      // 보는 쪽으로 4칸 가면 가운데
      expect(s.x + Math.cos(s.angle) * SPOT_RADIUS).toBeCloseTo(10.5, 9)
      expect(s.y + Math.sin(s.angle) * SPOT_RADIUS).toBeCloseTo(10.5, 9)
    }
  })

  test('내 자리(0번)에서 과녁까지 약 3~8칸 (시스템 기획서 방 화면 연습)', () => {
    const far = spots.slice(1).map((s) => Math.hypot(s.x - spots[0].x, s.y - spots[0].y))
    expect(Math.min(...far)).toBeCloseTo(2 * SPOT_RADIUS * Math.sin(Math.PI / 8), 9)
    expect(Math.max(...far)).toBeCloseTo(8, 9)
  })
})

describe('targetLooks', () => {
  test('내 캐릭터를 뺀 일곱 캐릭터. 사람 색은 캐릭터 번호와 같은 번호', () => {
    const looks = targetLooks(3)
    expect(looks.map((l) => l.character)).toEqual([0, 1, 2, 4, 5, 6, 7])
    expect(looks.every((l) => l.color === l.character && l.hand === 'right')).toBe(true)
  })
})

describe('addHole', () => {
  const hole = (target: string, at: number): Hole => ({ target, offset: 0, height: 0.5, at })

  test('같은 과녁을 맞히면 구멍이 쌓임', () => {
    expect(addHole([hole('a', 1)], hole('a', 2))).toEqual([hole('a', 1), hole('a', 2)])
  })

  test('다른 과녁을 맞히면 비우고 그 과녁의 구멍부터', () => {
    expect(addHole([hole('a', 1), hole('a', 2)], hole('b', 3))).toEqual([hole('b', 3)])
  })

  test('빈 카드에는 그대로 찍음', () => {
    expect(addHole([], hole('a', 1))).toEqual([hole('a', 1)])
  })
})

describe('liveHoles', () => {
  test('찍고 5초가 지난 구멍은 사라짐', () => {
    const holes: Hole[] = [{ target: 'a', offset: 0, height: 0.5, at: 0 }, { target: 'a', offset: 0, height: 0.6, at: 2000 }]
    expect(liveHoles(holes, HOLE_MS - 1)).toHaveLength(2)
    expect(liveHoles(holes, HOLE_MS)).toEqual([holes[1]])
    expect(liveHoles(holes, 2000 + HOLE_MS)).toEqual([])
  })
})
