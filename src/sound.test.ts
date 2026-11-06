import { describe, expect, test } from 'vitest'
import { toLocalTime } from './clock.ts'
import { makeCamera } from './render.ts'
import { heardFrom, stampOf, toAudioTime } from './sound.ts'

describe('toAudioTime', () => {
  test('스탬프와 같은 순간이면 contextTime', () => {
    expect(toAudioTime(10000, { contextTime: 2, performanceTime: 10000 })).toBe(2)
  })

  test('내 시각 ms만큼 지난 만큼 AudioContext 시각(초)도 지남', () => {
    const stamp = { contextTime: 2, performanceTime: 10000 }
    expect(toAudioTime(10500, stamp)).toBeCloseTo(2.5)
    expect(toAudioTime(9000, stamp)).toBeCloseTo(1)
  })

  test('서버가 알린 결투 시각을 내 시각을 거쳐 AudioContext 시각으로 바꿈', () => {
    // 서버 시계가 내 시계보다 4000ms 앞섬. 결투 시각 15000(서버) = 11000(내 시각)
    const duel = toLocalTime(15000, 4000)
    // 내 시각 10000에 스피커에서 나는 소리가 AudioContext 3초에 나간 소리임
    expect(toAudioTime(duel, { contextTime: 3, performanceTime: 10000 })).toBeCloseTo(4)
  })
})

describe('stampOf', () => {
  const fake = (contextTime: number, performanceTime: number, currentTime: number) =>
    ({ getOutputTimestamp: () => ({ contextTime, performanceTime }), currentTime }) as unknown as AudioContext

  test('출력 시각이 있으면 그대로 씀', () => {
    expect(stampOf(fake(1.5, 8000, 1.6))).toEqual({ contextTime: 1.5, performanceTime: 8000 })
  })

  test('아직 소리가 나가지 않아 0이면 지금 시각으로 이음', () => {
    const before = performance.now()
    const s = stampOf(fake(0, 0, 0.2))
    expect(s.contextTime).toBe(0.2)
    expect(s.performanceTime).toBeGreaterThanOrEqual(before)
    expect(s.performanceTime).toBeLessThanOrEqual(performance.now())
  })
})

describe('heardFrom', () => {
  test('시선 바로 앞이면 그 거리만큼 앞', () => {
    const p = heardFrom(5, 5, 0, 8, 5)
    expect(p.front).toBeCloseTo(3)
    expect(p.right).toBeCloseTo(0)
  })

  test('등 뒤면 앞이 음수', () => {
    expect(heardFrom(5, 5, Math.PI / 2, 5, 3).front).toBeCloseTo(-2)
  })

  test('화면 오른쪽(카메라 평면 쪽)에 선 사람은 오른쪽에서 들림', () => {
    for (const angle of [0, 1, Math.PI, 4.5]) {
      const cam = makeCamera(5, 5, angle, 66)
      const p = heardFrom(5, 5, angle, 5 + cam.planeX, 5 + cam.planeY)
      expect(p.right).toBeGreaterThan(0)
      expect(p.front).toBeCloseTo(0)
    }
  })

  test('거리는 그대로임', () => {
    const p = heardFrom(1, 2, 2.3, 4, 6)
    expect(Math.hypot(p.right, p.front)).toBeCloseTo(5)
  })
})
