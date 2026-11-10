import { describe, expect, test } from 'vitest'
import type { PlayerState } from './net.ts'
import { BAR_LEFT, BAR_RIGHT, bountyRise, bountyText, bubbleX, CHATTER_FIRST, CHATTER_GAP, CHATTER_SHOW, copyKeys, seatSlots, seatSpot, seatTag, startBartender, startChatter, stepBartender, stepChatter, WARDROBE_RIGHT } from './saloon.ts'

// seat번 좌석에 앉은 사람. 색은 따로 주지 않으면 좌석 번호와 같음
const player = (id: string, seat: number, extra: Partial<PlayerState> = {}): PlayerState => ({
  id,
  drawnAt: null,
  x: 0,
  y: 0,
  angle: 0,
  pose: 'stand',
  ready: false,
  nickname: `총잡이${seat}`,
  color: seat,
  wins: 0,
  pitch: 0,
  character: 0,
  seat,
  hand: 'right',
  ...extra,
})

describe('seatSlots', () => {
  test('좌석 수는 방 인원 제한이고 서버가 준 좌석 번호에 앉아, 나간 사람의 좌석은 비고 남은 사람은 그대로', () => {
    const slots = seatSlots([player('a', 0), player('c', 2)], 'c', 4)
    expect(slots).toHaveLength(4)
    expect(slots[0]?.nickname).toBe('총잡이0')
    expect(slots[1]).toBeNull()
    expect(slots[2]?.nickname).toBe('총잡이2')
    expect(slots[3]).toBeNull()
  })

  test('새로 온 사람은 서버가 준 빈 좌석 번호에 앉음', () => {
    const before = seatSlots([player('a', 0), player('c', 2)], null, 3)
    const after = seatSlots([player('a', 0), player('c', 2), player('d', 1)], null, 3)
    expect(before[1]).toBeNull()
    expect(after[1]?.nickname).toBe('총잡이1')
    expect(after[0]).toEqual(before[0])
    expect(after[2]).toEqual(before[2])
  })

  test('내 좌석, 준비, 이긴 횟수, 고른 캐릭터와 색을 그 사람 것으로 적음', () => {
    const slots = seatSlots([player('a', 0, { ready: true, wins: 2 }), player('b', 1, { character: 3, color: 6, hand: 'left' })], 'b', 2)
    expect(slots[0]).toEqual({ nickname: '총잡이0', character: 0, color: 0, hand: 'right', ready: true, mine: false, wins: 2 })
    expect(slots[1]).toEqual({ nickname: '총잡이1', character: 3, color: 6, hand: 'left', ready: false, mine: true, wins: 0 })
  })

  test('색을 바꿔도 좌석은 그대로이고, 좌석 수보다 큰 색 번호도 앉음 (SHEEP-118)', () => {
    const slots = seatSlots([player('a', 0, { color: 7 }), player('b', 1, { color: 0 })], null, 2)
    expect(slots[0]?.color).toBe(7)
    expect(slots[1]?.color).toBe(0)
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

describe('stepChatter', () => {
  const counts = { tips: 8, jokes: 6 }
  // 정해 둔 값을 차례로 돌려주는 난수
  const seq = (...xs: number[]) => () => xs.shift() ?? 0

  test('방에 들어오고 CHATTER_FIRST 뒤에 첫 말을 꺼내 CHATTER_SHOW 동안 띄움', () => {
    const c0 = startChatter(1000)
    expect(stepChatter(c0, 1000 + CHATTER_FIRST - 1, counts, seq(0)).line).toBeNull()
    const c1 = stepChatter(c0, 1000 + CHATTER_FIRST, counts, seq(0.2, 0.5))
    expect(c1.line).toEqual({ kind: 'tips', index: 4 })
    expect(stepChatter(c1, c1.until - 1, counts, seq(0))).toBe(c1)
    expect(stepChatter(c1, c1.until, counts, seq(0)).line).toBeNull()
    expect(c1.until - (1000 + CHATTER_FIRST)).toBe(CHATTER_SHOW)
  })

  test('난수 0.5부터는 농담', () => {
    const c = stepChatter(startChatter(0), CHATTER_FIRST, counts, seq(0.5, 0.99))
    expect(c.line).toEqual({ kind: 'jokes', index: 5 })
  })

  test('지운 뒤 다음 말까지 25~45초', () => {
    const shown = stepChatter(startChatter(0), CHATTER_FIRST, counts, seq(0, 0))
    expect(stepChatter(shown, shown.until, counts, seq(0)).next - shown.until).toBe(CHATTER_GAP[0])
    expect(stepChatter(shown, shown.until, counts, seq(1)).next - shown.until).toBe(CHATTER_GAP[1])
  })

  test('바로 앞 대사는 다시 고르지 않음', () => {
    const first = stepChatter(startChatter(0), CHATTER_FIRST, counts, seq(0, 0))
    const hidden = stepChatter(first, first.until, counts, seq(0))
    const second = stepChatter(hidden, hidden.next, counts, seq(0, 0))
    expect(second.line).toEqual({ kind: 'tips', index: 1 })
  })
})

describe('bubbleX', () => {
  test('술집 주인을 따르되 칠판(352px)과 왼쪽 현상금 게시판을 넘지 않음', () => {
    expect(bubbleX(200)).toBe(200)
    expect(bubbleX(BAR_RIGHT) + 75).toBeLessThanOrEqual(348)
    expect(bubbleX(0) - 75).toBeGreaterThanOrEqual(WARDROBE_RIGHT + 4)
  })
})
