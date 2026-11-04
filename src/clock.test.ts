import { describe, expect, test } from 'vitest'
import { best, measure, toLocalTime, toServerTime } from './clock.ts'

// 서버 시계가 내 시계보다 offset만큼 앞서고, 가는 데 out, 오는 데 back ms 걸린 한 번을 흉내 냄
function simulate(t0: number, offset: number, out: number, back: number) {
  return measure(t0, t0 + out + offset, t0 + out + back)
}

describe('measure', () => {
  test('왕복은 t1 - t0, 차이는 ts - (t0 + t1) / 2', () => {
    expect(measure(1000, 5050, 1100)).toEqual({ roundTrip: 100, offset: 4000 })
  })

  test('가는 지연과 오는 지연이 같으면 차이가 정확함', () => {
    expect(simulate(1000, 4000, 30, 30).offset).toBeCloseTo(4000)
  })

  test('가는 지연과 오는 지연이 다르면 오차가 왕복의 절반 안쪽임', () => {
    for (const [out, back] of [[10, 90], [90, 10], [0, 200], [200, 0], [35, 65]]) {
      const s = simulate(1000, 4000, out, back)
      expect(Math.abs(s.offset - 4000)).toBeLessThanOrEqual(s.roundTrip / 2)
    }
  })

  test('서버 시계가 뒤처져도 차이가 음수로 나옴', () => {
    expect(simulate(9000, -2500, 20, 20).offset).toBeCloseTo(-2500)
  })
})

describe('best', () => {
  test('왕복이 가장 짧은 값을 고름', () => {
    const samples = [simulate(0, 4000, 80, 20), simulate(200, 4000, 6, 4), simulate(400, 4000, 50, 50)]
    expect(best(samples)).toBe(samples[1])
    // 가장 짧은 왕복(10ms)이라 오차가 5ms 안쪽
    expect(Math.abs(best(samples).offset - 4000)).toBeLessThanOrEqual(5)
  })
})

describe('toServerTime, toLocalTime', () => {
  test('서로 바꾸면 처음 값으로 돌아옴', () => {
    expect(toServerTime(1000, 4000)).toBe(5000)
    expect(toLocalTime(5000, 4000)).toBe(1000)
    expect(toLocalTime(toServerTime(1234.5, -321.25), -321.25)).toBe(1234.5)
  })
})
