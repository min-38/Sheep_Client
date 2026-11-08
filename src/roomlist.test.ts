import { describe, expect, test } from 'vitest'
import { en } from './i18n/en.ts'
import { joinable, memberText, roomStatus, type RoomInfo } from './roomlist.ts'

const member = (nickname: string, color = 0) => ({ nickname, color })
const room = (count: number, max = 8, playing = false): RoomInfo => ({
  code: 'AB12CD',
  name: '먼지 낀 술집',
  players: Array.from({ length: count }, (_, i) => member(`사람${i + 1}`, i)),
  max,
  playing,
})

describe('memberText', () => {
  test('3명까지는 닉네임을 모두 적음', () => {
    expect(memberText([member('보안관')])).toBe('보안관')
    expect(memberText([member('보안관'), member('떠돌이'), member('총잡이')])).toBe('보안관, 떠돌이, 총잡이')
  })

  test('4명부터는 3명 뒤에 "외 N명" (시스템 기획서 방 화면 대기실 보기)', () => {
    expect(memberText(room(5).players)).toBe(en.lobby.members('사람1, 사람2, 사람3', 2))
  })
})

describe('roomStatus', () => {
  test('판 진행 중이 꽉 참보다 먼저', () => {
    expect(roomStatus(room(2, 2, true))).toBe(en.lobby.playing)
    expect(roomStatus(room(2, 2))).toBe(en.lobby.full)
    expect(roomStatus(room(1, 2))).toBe(en.lobby.waiting)
  })
})

describe('joinable', () => {
  test('판 도중이 아니고 꽉 차지 않은 방만 들어갈 수 있음', () => {
    expect(joinable(room(1))).toBe(true)
    expect(joinable(room(8))).toBe(false)
    expect(joinable(room(1, 8, true))).toBe(false)
  })
})
