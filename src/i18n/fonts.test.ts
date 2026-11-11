import { describe, expect, test } from 'vitest'
import jaChars from '../assets/fonts/ja-chars.txt?raw'
import zhChars from '../assets/fonts/zh-chars.txt?raw'
import jaSource from './ja.ts?raw'
import zhSource from './zh.ts?raw'

// 일본어·중국어 글꼴은 수 MB라 이 목록의 글자만 남겨 줄였음 (시스템 기획서 방 화면 글꼴, CREDITS.md, SHEEP-202).
// 문구에 목록에 없는 글자가 들어오면 그 글자만 기본 글꼴로 보이므로, CREDITS.md의 명령으로 목록과 글꼴을 다시 만듦
const CJK = /[　-ヿㇰ-ㇿ一-鿿＀-￯]/gu
const missing = (source: string, chars: string) => [...new Set(source.match(CJK))].filter((c) => !chars.includes(c)).join('')

describe('줄인 글꼴에 문구의 글자가 다 있음', () => {
  test('일본어', () => expect(missing(jaSource, jaChars)).toBe(''))
  test('중국어', () => expect(missing(zhSource, zhChars)).toBe(''))
})
