import { describe, expect, test } from 'vitest'
import type { PlayerState } from './net.ts'
import { BAR_LEFT, BAR_RIGHT, bountyRise, bountyText, posterSlots, startBartender, stepBartender } from './saloon.ts'

const player = (id: string, color: number, extra: Partial<PlayerState> = {}): PlayerState => ({
  id,
  x: 0,
  y: 0,
  angle: 0,
  pose: 'stand',
  ready: false,
  nickname: `총잡이${color}`,
  color,
  wins: 0,
  pitch: 0,
  ...extra,
})

describe('posterSlots', () => {
  test('목수건 색 번호가 자리 번호라 나간 사람의 자리는 비고 남은 사람은 그대로', () => {
    const slots = posterSlots([player('a', 0), player('c', 2)], 'c')
    expect(slots).toHaveLength(8)
    expect(slots[0]?.nickname).toBe('총잡이0')
    expect(slots[1]).toBeNull()
    expect(slots[2]?.nickname).toBe('총잡이2')
    expect(slots.slice(3).every((s) => s === null)).toBe(true)
  })

  test('내 포스터, 준비, 현상금을 그 사람 것으로 적음', () => {
    const slots = posterSlots([player('a', 0, { ready: true, wins: 2 }), player('b', 1)], 'b')
    expect(slots[0]).toEqual({ nickname: '총잡이0', color: 0, ready: true, mine: false, bounty: '$200' })
    expect(slots[1]).toEqual({ nickname: '총잡이1', color: 1, ready: false, mine: true, bounty: '' })
  })
})

describe('bountyText', () => {
  test('이긴 횟수 × $100이고 한 번도 이기지 않으면 적지 않음', () => {
    expect(bountyText(0)).toBe('')
    expect(bountyText(1)).toBe('$100')
    expect(bountyText(12)).toBe('$1200')
  })
})

describe('bountyRise', () => {
  // 승리가 정해진 틱의 state에 이미 오른 이긴 횟수가 옴 (기술 설계서 메시지 state wins)
  test('이긴 사람의 오르기 전과 뒤 현상금', () => {
    expect(bountyRise(2)).toBe('$100 → $200')
    expect(bountyRise(5)).toBe('$400 → $500')
  })

  test('첫 승리는 $0에서 오름', () => {
    expect(bountyRise(1)).toBe('$0 → $100')
  })
})

describe('stepBartender', () => {
  test('무엇을 고르든 선반 앞을 벗어나지 않음', () => {
    let seed = 1
    // 같은 결과가 나오게 고정한 의사 난수
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    let b = startBartender(0)
    for (let now = 0; now < 120000; now += 16) {
      b = stepBartender(b, now, 16, rand)
      expect(b.x).toBeGreaterThanOrEqual(BAR_LEFT)
      expect(b.x).toBeLessThanOrEqual(BAR_RIGHT)
    }
  })

  test('걷기, 서 있기, 잔 닦기를 모두 고름', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const seen = new Set<string>()
    let b = startBartender(0)
    for (let now = 0; now < 120000; now += 16) {
      b = stepBartender(b, now, 16, rand)
      seen.add(b.action)
    }
    expect([...seen].sort()).toEqual(['stand', 'walk', 'wipe'])
  })
})
