import { describe, expect, test } from 'vitest'
import { normalizeRoomName, randomRoomName } from './roomname.ts'

describe('normalizeRoomName', () => {
  // 서버 RoomNameTests와 같은 표. 둘이 어긋나면 클라가 받아 준 이름을 서버가 버림
  test.each([
    ['먼지 낀 술집', '먼지 낀 술집'],
    ['  Dusty Saloon ', 'Dusty Saloon'],
    ['東京の酒場', '東京の酒場'],
    ['🎲🎲', '🎲🎲'],
    ['ab', 'ab'],
    ['가나다라마바사아자차카타파하가나', '가나다라마바사아자차카타파하가나'],
  ])('맞는 이름 %j는 앞뒤 공백을 지운 %j', (raw, name) => {
    expect(normalizeRoomName(raw)).toBe(name)
  })

  // 가족 이모지는 여러 코드 포인트지만 한 글자라 1자임
  test.each(['a', '가나다라마바사아자차카타파하가나다', 'a\nb', 'a\u0007b', '   ', '👨‍👩‍👧‍👦'])('틀린 이름 %j는 null', (raw) => {
    expect(normalizeRoomName(raw)).toBeNull()
  })
})

describe('randomRoomName', () => {
  test('어떤 무작위 값이 나와도 규칙에 맞는 이름', () => {
    for (let i = 0; i < 100; i++) {
      const r = i / 100
      const name = randomRoomName(() => r)
      expect(normalizeRoomName(name)).toBe(name)
    }
  })

  test('같은 무작위 값이면 같은 이름', () => {
    expect(randomRoomName(() => 0.3)).toBe(randomRoomName(() => 0.3))
  })
})
