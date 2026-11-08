import { t } from './i18n/index.ts'

// 방 이름 규칙 (시스템 기획서 방 화면 방 만들기 창). 서버 RoomName.Normalize와 같은 규칙이어야, 클라가 받아 준 이름을 서버가 버리지 않음.
// 아무 글자 2~16자, 모든 언어. 글자 수는 눈에 보이는 글자(문자소)로 셈
const MIN = 2
const MAX = 16
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
// 줄바꿈 같은 제어 문자는 목록과 칠판의 한 줄을 깨뜨려 받지 않음
const CONTROL = /\p{Cc}/u

// 앞뒤 공백을 지우고 규칙에 맞으면 그 이름, 아니면 null
export function normalizeRoomName(raw: string): string | null {
  const name = raw.trim()
  if (CONTROL.test(name)) return null
  const length = [...graphemes.segment(name)].length
  return length >= MIN && length <= MAX ? name : null
}

// 주사위 버튼의 무작위 이름. 지금 언어의 서부 느낌 낱말 둘을 하나씩 골라 이음. 가장 긴 조합도 16자 안임 (i18n 테스트)

const pick = <T>(list: readonly T[], rand: () => number) => list[Math.floor(rand() * list.length) % list.length]

export function randomRoomName(rand: () => number = Math.random) {
  const { first, second, name } = t.create.dice
  return name(pick(first, rand), pick(second, rand))
}
