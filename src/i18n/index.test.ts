import { afterEach, describe, expect, test } from 'vitest'
import html from '../../index.html?raw'
import { normalizeRoomName } from '../roomname.ts'
import { en, type Copy } from './en.ts'
import { copyOf, isLanguage, LANGUAGES, setLanguage, t, textAt } from './index.ts'

// index.html의 data-i18n, data-i18n-label, data-i18n-placeholder에 적은 키
const htmlKeys = [...html.matchAll(/data-i18n(?:-label|-placeholder)?="([^"]+)"/g)].map((m) => m[1])

// 문구 꼴을 훑어 글자 칸만 꺼냄. 함수는 넣을 값이 있어야 해 따로 봄
function strings(copy: unknown, path = ''): [string, string][] {
  if (typeof copy === 'string') return [[path, copy]]
  if (typeof copy !== 'object' || copy === null) return []
  return Object.entries(copy).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
}

afterEach(() => setLanguage('en'))

describe('언어 목록', () => {
  test('영어, 독일어, 스페인어, 러시아어, 일본어, 중국어, 한국어 (CLAUDE.md 언어)', () => {
    expect(LANGUAGES).toEqual(['en', 'de', 'es', 'ru', 'ja', 'zh', 'ko'])
  })

  test('목록에는 언어마다 그 언어로 쓴 이름', () => {
    expect(LANGUAGES.map((l) => copyOf(l).languageName)).toEqual(['English', 'Deutsch', 'Español', 'Русский', '日本語', '简体中文', '한국어'])
  })

  test('목록에 있는 코드만 언어로 봄', () => {
    expect(isLanguage('ko')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})

describe('문구', () => {
  test('처음에는 영어', () => {
    expect(t).toBe(en)
  })

  test('언어를 바꾸면 t가 그 언어의 문구가 됨', () => {
    setLanguage('ko')
    expect(t).toBe(copyOf('ko'))
    expect(t.lobby.join).toBe('입장')
  })

  test('제목은 모든 언어에서 같은 영어 제목', () => {
    for (const l of LANGUAGES) expect(copyOf(l).title).toBe('The Quick, the Slow and the Shot!')
  })

  test('첫 화면 제목 세 줄을 이으면 제목 그대로 (시스템 기획서 방 화면 M8 첫 화면)', () => {
    for (const l of LANGUAGES) expect(copyOf(l).titleLines).toEqual(['The Quick,', 'the Slow', 'and the Shot!'])
    expect(en.titleLines.join(' ')).toBe(en.title)
  })

  test.each(LANGUAGES)('%s: index.html에 적은 키가 모두 글자로 있음', (l) => {
    expect(htmlKeys.length).toBeGreaterThan(30)
    for (const key of htmlKeys) expect(textAt(copyOf(l), key), key).toEqual(expect.any(String))
  })

  test.each(LANGUAGES)('%s: 도움말은 그림 8장과 같은 수의 줄 (시스템 기획서 방 화면 도움말, SHEEP-196)', (l) => {
    expect(copyOf(l).help.pages).toHaveLength(8)
  })

  test.each(LANGUAGES)('%s: 빈 문구가 없음', (l) => {
    for (const [path, text] of strings(copyOf(l))) expect(text.trim(), path).not.toBe('')
  })

  test.each(LANGUAGES)('%s: 좌석 꼬리표의 이긴 횟수는 모든 언어에서 영어로 적음. 1만 Win (사용자 결정 2026-11-11, SHEEP-178)', (l) => {
    expect([0, 1, 2, 10].map(copyOf(l).saloon.wins)).toEqual(['0 Wins', '1 Win', '2 Wins', '10 Wins'])
  })

  test.each(LANGUAGES)('%s: 마지막 쓰러짐 자막은 쏜 이와 쓰러진 이의 이름을 모두 적음 (SHEEP-180)', (l) => {
    const { fallLine } = copyOf(l).hud
    for (const zone of ['head', 'body'] as const) {
      expect(fallLine[zone]('Shooter', 'Fallen')).toContain('Shooter')
      expect(fallLine[zone]('Shooter', 'Fallen')).toContain('Fallen')
    }
    expect(fallLine.timeout('Fallen')).toContain('Fallen')
  })

  test.each(LANGUAGES)('%s: 캐릭터 이름 수가 영어와 같음', (l) => {
    expect(copyOf(l).lobby.characterNames).toHaveLength(en.lobby.characterNames.length)
  })

  test('술집 주인 대사는 언어마다 영어와 같은 수 (SHEEP-116)', () => {
    for (const language of LANGUAGES) {
      const { tips, jokes } = copyOf(language).saloon.bartender
      expect([tips.length, jokes.length]).toEqual([en.saloon.bartender.tips.length, en.saloon.bartender.jokes.length])
      expect([...tips, ...jokes].every((line) => typeof line === 'string' && line.length > 0)).toBe(true)
    }
  })

  test('없는 키는 undefined', () => {
    expect(textAt(en, 'lobby.nope')).toBeUndefined()
    expect(textAt(en, 'lobby')).toBeUndefined()
  })
})

describe('주사위 방 이름 낱말', () => {
  test.each(LANGUAGES)('%s: 어떤 조합도 방 이름 규칙(2~16자)에 맞음', (l) => {
    const { first, second, name }: Copy['create']['dice'] = copyOf(l).create.dice
    expect(first.length).toBeGreaterThan(5)
    expect(second.length).toBeGreaterThan(5)
    for (const a of first) for (const b of second) expect(normalizeRoomName(name(a, b)), name(a, b)).toBe(name(a, b))
  })
})
