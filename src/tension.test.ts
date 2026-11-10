import { describe, expect, test } from 'vitest'
import { STEP_MS, STEPS, STEPS_FROM, TURN_MS } from './round.ts'
import { darkness, heartbeats, stepDip } from './tension.ts'

const walk = 10000
// 마지막(10번째) 걸음을 내딛는 시각
const lastStep = walk + STEPS_FROM + (STEPS - 1) * STEP_MS

describe('heartbeats', () => {
  test('다 돌고 뜸을 들이기 시작할 때부터 마지막 걸음 전까지 뜀 (사용자 결정 2026-11-10, SHEEP-141)', () => {
    const beats = heartbeats(walk)
    expect(beats[0]).toBe(walk + TURN_MS)
    expect(beats.at(-1)!).toBeLessThan(lastStep)
    expect(beats.length).toBeGreaterThan(5)
  })

  test('갈수록 빨라짐', () => {
    const gaps = heartbeats(walk).slice(1).map((b, i, rest) => b - (i === 0 ? heartbeats(walk)[0] : rest[i - 1]))
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1])
  })
})

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

  test('박동 바로 뒤가 박동 사이보다 짙음', () => {
    const [, second, third] = heartbeats(walk)
    expect(darkness({ walk }, second + 20)).toBeGreaterThan(darkness({ walk }, (second + third) / 2))
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
