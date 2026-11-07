import { describe, expect, test } from 'vitest'
import { record, sampleAt, type Sample } from './interpolate.ts'

const deg = (d: number) => (d * Math.PI) / 180

describe('sampleAt', () => {
  const a: Sample = { at: 1000, x: 2, y: 4, angle: deg(10), pitch: 0.1, pose: 'walk' }
  const b: Sample = { at: 1050, x: 4, y: 8, angle: deg(30), pitch: 0.3, pose: 'stand' }

  test('두 상태 사이 중간 시각은 위치와 각도, 위아래 시선도 중간', () => {
    const s = sampleAt([a, b], 1025)
    expect(s.x).toBeCloseTo(3)
    expect(s.y).toBeCloseTo(6)
    expect(s.angle).toBeCloseTo(deg(20))
    expect(s.pitch).toBeCloseTo(0.2)
  })

  test('동작은 그 시각에 마지막으로 받은 상태의 것', () => {
    expect(sampleAt([a, b], 1049).pose).toBe('walk')
    expect(sampleAt([a, b], 1050).pose).toBe('stand')
  })

  test('359°에서 1°로는 2°만 돎', () => {
    // 4분의 1 지점. 긴 쪽(358°)으로 돌면 269.5°가 됨
    expect(sampleAt([{ ...a, angle: deg(359) }, { ...b, angle: deg(1) }], 1012.5).angle).toBeCloseTo(deg(359.5))
    // 거꾸로 1°에서 359°로도 짧은 쪽. 긴 쪽이면 90.5°가 됨
    expect(sampleAt([{ ...a, angle: deg(1) }, { ...b, angle: deg(359) }], 1012.5).angle).toBeCloseTo(deg(0.5))
  })

  test('상태가 하나뿐이면 그 상태 그대로', () => {
    expect(sampleAt([a], 900)).toEqual(a)
    expect(sampleAt([a], 1100)).toEqual(a)
  })

  test('쌓인 상태보다 이르거나 늦은 시각은 끝 상태 그대로', () => {
    expect(sampleAt([a, b], 900)).toEqual(a)
    expect(sampleAt([a, b], 1100)).toEqual(b)
  })

  test('여러 상태 중 그 시각을 감싸는 두 상태를 씀', () => {
    const c: Sample = { at: 1100, x: 8, y: 8, angle: deg(30), pitch: 0.3, pose: 'stand' }
    expect(sampleAt([a, b, c], 1075).x).toBeCloseTo(6)
  })

  test('같은 시각에 받은 두 상태는 뒤의 것을 씀', () => {
    expect(sampleAt([a, { ...b, at: 1000 }], 1000)).toEqual({ ...b, at: 1000 })
  })
})

describe('record', () => {
  const p = (id: string, x: number) => ({ id, x, y: 0, angle: 0, pitch: -0.2, pose: 'stand' as const, ready: false, nickname: '보안관', color: 0, wins: 0 })

  test('플레이어마다 받은 시각과 함께 쌓음', () => {
    const history = new Map<string, Sample[]>()
    record(history, [p('a', 1), p('b', 2)], 1000)
    record(history, [p('a', 3), p('b', 4)], 1050)
    expect(history.get('a')).toEqual([
      { at: 1000, x: 1, y: 0, angle: 0, pitch: -0.2, pose: 'stand' },
      { at: 1050, x: 3, y: 0, angle: 0, pitch: -0.2, pose: 'stand' },
    ])
    expect(history.get('b')?.map((s) => s.x)).toEqual([2, 4])
  })

  test('state에서 빠진 사람은 지움', () => {
    const history = new Map<string, Sample[]>()
    record(history, [p('a', 1), p('b', 2)], 1000)
    record(history, [p('a', 3)], 1050)
    expect([...history.keys()]).toEqual(['a'])
  })

  test('오래된 상태는 버려 끝없이 쌓이지 않음', () => {
    const history = new Map<string, Sample[]>()
    for (let i = 0; i < 1000; i++) record(history, [p('a', i)], i * 50)
    const samples = history.get('a')!
    expect(samples.length).toBeLessThan(1000)
    expect(samples.at(-1)?.x).toBe(999)
  })

  test('다시 보기에 쓰도록 6초어치(20Hz로 120개)를 남김 (시스템 기획서 HUD 다시 보기)', () => {
    const history = new Map<string, Sample[]>()
    for (let i = 0; i < 200; i++) record(history, [p('a', i)], i * 50)
    expect(history.get('a')).toHaveLength(120)
  })
})
