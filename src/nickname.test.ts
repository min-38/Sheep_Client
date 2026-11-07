import { describe, expect, test } from 'vitest'
import { normalizeNickname } from './nickname.ts'

describe('normalizeNickname', () => {
  // 서버 NicknameTests와 같은 표. 둘이 어긋나면 클라가 받아 준 이름을 서버가 버림
  test.each([
    ['보안관', '보안관'],
    ['  Kid7 ', 'Kid7'],
    ['가나', '가나'],
    ['가나다라마바사아', '가나다라마바사아'],
    ['Billy99', 'Billy99'],
  ])('맞는 이름 %j는 앞뒤 공백을 지운 %j', (raw, name) => {
    expect(normalizeNickname(raw)).toBe(name)
  })

  test.each(['가', '가나다라마바사아자', '보 안', '보안관!', 'ㅋㅋ', '', '   '])('틀린 이름 %j는 null', (raw) => {
    expect(normalizeNickname(raw)).toBeNull()
  })
})
