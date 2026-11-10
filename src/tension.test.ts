import { describe, expect, test } from 'vitest'
import { STEP_MS, STEPS, STEPS_FROM, TURN_MS } from './round.ts'
import { darkness, stepDip } from './tension.ts'

const walk = 10000
// 마지막(10번째) 걸음을 내딛는 시각
const lastStep = walk + STEPS_FROM + (STEPS - 1) * STEP_MS

describe('darkness', () => {
  test('다 돌기 전과 "시작!"부터는 어둡지 않음', () => {
    expect(darkness({ walk }, walk + TURN_MS - 1)).toBe(0)
    expect(darkness({ walk, duel: lastStep + 2000 }, lastStep + 2000)).toBe(0)
    expect(darkness({}, walk)).toBe(0)
  })

  test('마지막 걸음까지 점점 짙어지고 "시작!"까지 그대로', () => {
    const early = darkness({ walk }, walk + TURN_MS + 400)
    const late = darkness({ walk }, lastStep - 1)
    expect(late).toBeGreaterThan(early)
    expect(darkness({ walk, duel: lastStep + 2000 }, lastStep + 1500)).toBeGreaterThan(early)
  })

  test('박동처럼 뛰지 않고 고르게 짙어짐 (사용자 결정 2026-11-10, SHEEP-147)', () => {
    const start = walk + TURN_MS
    let before = darkness({ walk }, start)
    for (let t = start + 50; t < lastStep; t += 50) {
      const d = darkness({ walk }, t)
      expect(d).toBeGreaterThan(before)
      before = d
    }
  })
})

describe('stepDip', () => {
  test('걷는 동안만 내려앉음', () => {
    expect(stepDip(walk, walk + STEPS_FROM - 1).dip).toBe(0)
    expect(stepDip(walk, walk + STEPS_FROM + STEPS * STEP_MS).dip).toBe(0)
  })

  test('걸음을 디딘 직후 가장 깊고 다음 걸음 전에 거의 올라옴. 기울기는 걸음마다 좌우가 바뀜', () => {
    const first = walk + STEPS_FROM
    const deep = stepDip(walk, first + STEP_MS * 0.2)
    expect(deep.dip).toBeCloseTo(1)
    expect(stepDip(walk, first + STEP_MS - 1).dip).toBeLessThan(0.05)
    expect(Math.sign(stepDip(walk, first + STEP_MS * 1.2).tilt)).toBe(-Math.sign(deep.tilt))
  })
})
