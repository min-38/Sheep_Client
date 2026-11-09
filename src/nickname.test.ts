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
    ['ㅁㅁ', 'ㅁㅁ'],
    ['ㅋㅋ보안관', 'ㅋㅋ보안관'],
    ['東京太郎', '東京太郎'],
    ['张三', '张三'],
    ['Иван', 'Иван'],
    ['Müller', 'Müller'],
    ['Müller', 'Müller'], // u와 붙임 꼴 점은 한 글자
    ['José', 'José'],
    ['보 안', '보 안'],
    ['보안관!', '보안관!'],
    ['<script>', '<script>'], // 클라는 이름을 HTML로 읽지 않음(textContent와 캔버스 글자)
    ['🎲🎲', '🎲🎲'],
    ['🎲🎲🎲🎲🎲🎲🎲🎲', '🎲🎲🎲🎲🎲🎲🎲🎲'], // UTF-16으로 16칸이어도 8자
  ])('맞는 이름 %j는 앞뒤 공백을 지운 %j', (raw, name) => {
    expect(normalizeNickname(raw)).toBe(name)
  })

  test.each([
    '가',
    '가나다라마바사아자',
    '🎲🎲🎲🎲🎲🎲🎲🎲🎲',
    '',
    '   ',
    'a\nb', // 제어 문자(Cc)
    'a\u0007b',
    'ab​', // 서식 문자(Cf): 폭 없는 공백
    '‮ab', // 서식 문자(Cf): 글자 방향 바꾸기
    '﻿ab', // 서식 문자(Cf): 바이트 순서 표시. JS trim은 지우지만 서버 Trim은 지우지 않음
    '\u{1F468}‍\u{1F469}‍\u{1F467}', // 폭 없는 이음 문자(Cf)로 이은 가족 이모지
    'a b', // 줄 구분 문자(Zl)
    'a b', // 문단 구분 문자(Zp)
    'ㅤㅤ', // 한글 채움 문자
    'abㅤ',
    'aᅟb',
    'aᅠb',
    'aﾠb',
  ])('틀린 이름 %j는 null', (raw) => {
    expect(normalizeNickname(raw)).toBeNull()
  })
})
