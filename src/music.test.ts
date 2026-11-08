import { describe, expect, test } from 'vitest'
import { trackAt } from './music.ts'

describe('trackAt', () => {
  test('첫 화면과 술집은 판 시각과 상관없이 그 화면의 곡', () => {
    expect(trackAt('title', {}, 0)).toBe('title')
    expect(trackAt('saloon', { countdown: 1000, walk: 2000, duel: 6000 }, 7000)).toBe('saloon')
  })

  test('결투장에서는 "시작!" 전까지 결투 전 곡', () => {
    // 카운트다운을 받아 술집을 닫은 뒤, 카운트다운 시각 전에도 틂
    expect(trackAt('arena', {}, 500)).toBe('standoff')
    expect(trackAt('arena', { countdown: 1000, walk: 4000 }, 6000)).toBe('standoff')
    expect(trackAt('arena', { countdown: 1000, walk: 4000, duel: 9000 }, 8999)).toBe('standoff')
  })

  test('"시작!"부터 결투와 판 결과 동안은 조용함', () => {
    const s = { countdown: 1000, walk: 4000, duel: 9000 }
    expect(trackAt('arena', s, 9000)).toBeNull()
    expect(trackAt('arena', s, 20000)).toBeNull()
  })

  test('재대결 카운트다운에 판 시각을 비우면 다시 결투 전 곡', () => {
    expect(trackAt('arena', { countdown: 25000 }, 24000)).toBe('standoff')
  })
})
