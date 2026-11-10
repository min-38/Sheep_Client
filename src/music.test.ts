import { describe, expect, test } from 'vitest'
import { trackAt } from './music.ts'
import { STEPS_FROM, WALK_DURATION } from './round.ts'

describe('trackAt', () => {
  test('첫 화면과 술집은 판 시각과 상관없이 그 화면의 곡', () => {
    expect(trackAt('title', {}, 0)).toBe('title')
    expect(trackAt('saloon', { countdown: 1000, walk: 2000, duel: 6000 }, 7000)).toBe('saloon')
  })

  test('결투장에서는 10걸음을 다 걸을 때까지 결투 전 곡', () => {
    // 카운트다운을 받아 술집을 닫은 뒤, 카운트다운 시각 전에도 틂
    expect(trackAt('arena', {}, 500)).toBe('standoff')
    expect(trackAt('arena', { countdown: 1000, walk: 4000 }, 6000)).toBe('standoff')
    expect(trackAt('arena', { countdown: 1000, walk: 4000 }, 4000 + STEPS_FROM + WALK_DURATION - 1)).toBe('standoff')
  })

  test('다 걸은 뒤부터 "시작!"을 기다리는 동안, 결투와 판 결과 동안은 조용함 (사용자 결정 2026-11-10, SHEEP-141)', () => {
    const walkEnd = 4000 + STEPS_FROM + WALK_DURATION
    const s = { countdown: 1000, walk: 4000, duel: walkEnd + 2000 }
    expect(trackAt('arena', s, walkEnd)).toBeNull()
    expect(trackAt('arena', s, walkEnd + 2000)).toBeNull()
    expect(trackAt('arena', s, walkEnd + 20000)).toBeNull()
  })

  test('재대결 카운트다운에 판 시각을 비우면 다시 결투 전 곡', () => {
    expect(trackAt('arena', { countdown: 25000 }, 24000)).toBe('standoff')
  })

  test('승리 결과 동안은 승리 곡. 재대결 결과와 결투 중에는 아님 (SHEEP-150)', () => {
    const s = { countdown: 1000, walk: 4000, duel: 20000 }
    expect(trackAt('arena', s, 22000, true)).toBe('victory')
    expect(trackAt('arena', s, 22000, false)).toBeNull()
    expect(trackAt('arena', s, 21000)).toBeNull()
    // 승리가 끝나 술집으로 돌아가면 술집 곡
    expect(trackAt('saloon', s, 33000, true)).toBe('saloon')
  })
})
