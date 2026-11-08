import { describe, expect, test } from 'vitest'
import type { PlayerState } from './net.ts'
import { nextTarget } from './spectate.ts'

const p = (id: string, pose: PlayerState['pose'] = 'stand'): PlayerState => ({
  id,
  x: 0,
  y: 0,
  angle: 0,
  pitch: 0,
  pose,
  ready: false,
  nickname: id,
  color: 0,
  wins: 0,
})

describe('nextTarget', () => {
  // state 순서가 들어온 순서임 (컨셉 기획서 규칙 탈락한 뒤 관전)
  const room = [p('a'), p('me', 'down'), p('b', 'down'), p('c'), p('d')]

  test('처음에는 들어온 순서로 첫 번째 서 있는 사람', () => {
    expect(nextTarget(room, 'me', null)).toBe('a')
  })

  test('다음 서 있는 사람으로 넘어가고, 쓰러진 사람과 나는 건너뜀', () => {
    expect(nextTarget(room, 'me', 'a')).toBe('c')
    expect(nextTarget(room, 'me', 'c')).toBe('d')
  })

  test('끝이면 처음으로 돌아감', () => {
    expect(nextTarget(room, 'me', 'd')).toBe('a')
  })

  test('보던 사람이 쓰러지면 그 자리의 다음 사람', () => {
    const later = [p('a'), p('me', 'down'), p('b', 'down'), p('c', 'down'), p('d')]
    expect(nextTarget(later, 'me', 'c')).toBe('d')
  })

  test('보던 사람이 나가면 처음 사람', () => {
    expect(nextTarget(room, 'me', 'gone')).toBe('a')
  })

  test('서 있는 사람이 보던 사람 하나뿐이면 그 사람 그대로', () => {
    expect(nextTarget([p('me', 'down'), p('a')], 'me', 'a')).toBe('a')
  })

  test('아무도 서 있지 않으면 null', () => {
    expect(nextTarget([p('me', 'down'), p('a', 'down')], 'me', 'a')).toBeNull()
    expect(nextTarget([], 'me', null)).toBeNull()
  })
})
