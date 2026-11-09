import { describe, expect, test } from 'vitest'
import type { PlayerState } from './net.ts'
import { BAR_LEFT, BAR_RIGHT, bountyRise, bountyText, copyKeys, seatSlots, seatSpot, seatTag, startBartender, stepBartender, tally } from './saloon.ts'

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
  character: 0,
  ...extra,
})

describe('seatSlots', () => {
  test('좌석 수는 방 인원 제한이고 목수건 색 번호가 좌석 번호라, 나간 사람의 좌석은 비고 남은 사람은 그대로', () => {
    const slots = seatSlots([player('a', 0), player('c', 2)], 'c', 4)
    expect(slots).toHaveLength(4)
    expect(slots[0]?.nickname).toBe('총잡이0')
    expect(slots[1]).toBeNull()
    expect(slots[2]?.nickname).toBe('총잡이2')
    expect(slots[3]).toBeNull()
  })

  test('새로 온 사람은 서버가 준 빈 색 번호의 좌석에 앉음', () => {
    const before = seatSlots([player('a', 0), player('c', 2)], null, 3)
    const after = seatSlots([player('a', 0), player('c', 2), player('d', 1)], null, 3)
    expect(before[1]).toBeNull()
    expect(after[1]?.nickname).toBe('총잡이1')
    expect(after[0]).toEqual(before[0])
    expect(after[2]).toEqual(before[2])
  })

  test('내 좌석, 준비, 이긴 횟수, 고른 캐릭터를 그 사람 것으로 적음', () => {
    const slots = seatSlots([player('a', 0, { ready: true, wins: 2 }), player('b', 1, { character: 0 })], 'b', 2)
    expect(slots[0]).toEqual({ nickname: '총잡이0', character: 0, ready: true, mine: false, wins: 2 })
    expect(slots[1]).toEqual({ nickname: '총잡이1', character: 0, ready: false, mine: true, wins: 0 })
  })
})

describe('tally', () => {
  test('이긴 횟수만큼 칼자국, 9번이 넘으면 숫자', () => {
    expect(tally(0)).toBe('')
    expect(tally(3)).toBe('|||')
    expect(tally(9)).toBe('|||||||||')
    expect(tally(10)).toBe('10')
  })
})

describe('seatSpot, seatTag', () => {
  test('좌석은 가운데를 두고 좌우로 고르게 놓이고, 0번이 화면 왼쪽', () => {
    for (const n of [2, 5, 8]) {
      const xs = Array.from({ length: n }, (_, i) => seatTag(i, n).x)
      expect(xs[0] + xs[n - 1]).toBeCloseTo(480, 6)
      for (let i = 1; i < n; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
      expect(seatSpot(0, n).y).toBeLessThan(0)
    }
  })

  test('8명 방도 꼬리표가 모두 화면 안', () => {
    for (let i = 0; i < 8; i++) {
      const at = seatTag(i, 8)
      expect(at.x).toBeGreaterThan(26)
      expect(at.x).toBeLessThan(454)
      expect(at.y).toBeGreaterThan(20)
    }
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

describe('copyKeys', () => {
  test('애플 기기는 ⌘C, 그 밖은 Ctrl+C', () => {
    expect(copyKeys('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('⌘C')
    expect(copyKeys('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('⌘C')
    expect(copyKeys('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Ctrl+C')
  })
})
