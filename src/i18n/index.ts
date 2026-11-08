// 화면 언어 (CLAUDE.md Client copy, 시스템 기획서 방 화면 설정). 처음엔 영어이고 설정에서 고른 언어로 바꿈
import { de } from './de.ts'
import { en, type Copy } from './en.ts'
import { es } from './es.ts'
import { ja } from './ja.ts'
import { ko } from './ko.ts'
import { ru } from './ru.ts'
import { zh } from './zh.ts'

// 설정의 언어 목록 순서
export const LANGUAGES = ['en', 'de', 'es', 'ru', 'ja', 'zh', 'ko'] as const
export type Language = (typeof LANGUAGES)[number]

const COPIES: Record<Language, Copy> = { en, de, es, ru, ja, zh, ko }
// <html lang>에 넣는 값. 중국어는 간체라 글꼴을 고르는 브라우저가 간체 글자꼴을 쓰게 zh-Hans
export const HTML_LANG: Record<Language, string> = { en: 'en', de: 'de', es: 'es', ru: 'ru', ja: 'ja', zh: 'zh-Hans', ko: 'ko' }

export const copyOf = (language: Language) => COPIES[language]
export const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language)

// 지금 언어의 문구. 가져다 쓰는 모듈은 늘 바뀐 값을 봄 (ES 모듈의 살아 있는 바인딩)
export let t: Copy = en

export function setLanguage(language: Language) {
  t = COPIES[language]
}

// 'lobby.join' 같은 점 키로 글자 문구를 찾음. index.html의 data-i18n 키를 읽을 때 씀. 글자가 아니면 undefined
export function textAt(copy: Copy, key: string): string | undefined {
  let v: unknown = copy
  for (const k of key.split('.')) v = typeof v === 'object' && v !== null ? (v as Record<string, unknown>)[k] : undefined
  return typeof v === 'string' ? v : undefined
}
