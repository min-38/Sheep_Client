import { isLanguage, type Language } from './i18n/index.ts'

// 플레이어 설정 (시스템 기획서 방 화면 설정). 브라우저에 기억하고 바꾸면 바로 적용함.
// sensitivity는 감도 배율(1이 100%), music·effects는 소리 크기(0~1), language는 화면 언어, crosshair는 조준점 모양
export type Hand = 'right' | 'left'
// 조준점 모양. 고리와 점(처음 모양), 십자, 점, 고리. 색은 흰색 하나 (시스템 기획서 HUD 조준점)
export const CROSSHAIRS = ['ringDot', 'cross', 'dot', 'ring'] as const
export type Crosshair = (typeof CROSSHAIRS)[number]
export type Settings = { sensitivity: number; music: number; effects: number; hand: Hand; language: Language; crosshair: Crosshair }

// ponytail: 임시 값(시스템 기획서 방 화면 설정). 플레이해 보며 정함
export const DEFAULT_SETTINGS: Settings = { sensitivity: 1, music: 0.6, effects: 1, hand: 'right', language: 'en', crosshair: 'ringDot' }
export const MIN_SENSITIVITY = 0.25
export const MAX_SENSITIVITY = 4
// 라디안/px. 감도 100%일 때 마우스 1px에 도는 각도
const BASE_SENSITIVITY = 0.003

export const radiansPerPixel = (s: Settings) => BASE_SENSITIVITY * s.sensitivity

const within = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && v >= min && v <= max
const isCrosshair = (v: unknown): v is Crosshair => CROSSHAIRS.includes(v as Crosshair)

// localStorage에 기억한 글을 읽음. 없거나 깨졌으면 기본값이고, 칸마다 틀린 것만 기본값으로 채움.
// 손으로 고쳐 넣거나 다음 버전에서 칸이 바뀌어도 다른 칸은 살림
export function readSettings(raw: string | null): Settings {
  let saved: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(raw ?? '')
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>
  } catch {}
  return {
    sensitivity: within(saved.sensitivity, MIN_SENSITIVITY, MAX_SENSITIVITY) ? saved.sensitivity : DEFAULT_SETTINGS.sensitivity,
    music: within(saved.music, 0, 1) ? saved.music : DEFAULT_SETTINGS.music,
    effects: within(saved.effects, 0, 1) ? saved.effects : DEFAULT_SETTINGS.effects,
    hand: saved.hand === 'left' || saved.hand === 'right' ? saved.hand : DEFAULT_SETTINGS.hand,
    language: isLanguage(saved.language) ? saved.language : DEFAULT_SETTINGS.language,
    crosshair: isCrosshair(saved.crosshair) ? saved.crosshair : DEFAULT_SETTINGS.crosshair,
  }
}
