// 닉네임 규칙 (시스템 기획서 방 화면 닉네임). 서버 Nickname.Normalize와 같은 규칙이어야, 클라가 받아 준 이름을 서버가 버리지 않음.
// 어느 나라 글자든 2~8자. 글자 수는 눈에 보이는 글자(문자소)로 셈
const MIN = 2
const MAX = 8
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
// 보이지 않는 글자: 제어(Cc)·서식(Cf)·줄과 문단 구분(Zl, Zp) 문자와 한글 채움 문자. 빈 이름이나 남의 이름 흉내를 막음
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}ᅟᅠㅤﾠ]/u
// 앞뒤 공백. JS trim은 U+FEFF도 지우지만 서버 Trim(C#)은 지우지 않아, 그것만 남겨 서버처럼 받지 않게 함
const EDGE_SPACE = /^[^\S﻿]+|[^\S﻿]+$/g

// 앞뒤 공백을 지우고 규칙에 맞으면 그 이름, 아니면 null
export function normalizeNickname(raw: string): string | null {
  const name = raw.replace(EDGE_SPACE, '')
  if (INVISIBLE.test(name)) return null
  const length = [...graphemes.segment(name)].length
  return length >= MIN && length <= MAX ? name : null
}
