// 플레이어 설정 (시스템 기획서 방 화면 설정). 브라우저에 기억하고 바꾸면 바로 적용함.
// sensitivity는 감도 배율(1이 100%), music·effects는 소리 크기(0~1)
export type Hand = 'right' | 'left'
export type Settings = { sensitivity: number; music: number; effects: number; hand: Hand }

// ponytail: 임시 값(시스템 기획서 방 화면 설정). 플레이해 보며 정함
export const DEFAULT_SETTINGS: Settings = { sensitivity: 1, music: 0.6, effects: 1, hand: 'right' }
export const MIN_SENSITIVITY = 0.25
export const MAX_SENSITIVITY = 4
// 라디안/px. 감도 100%일 때 마우스 1px에 도는 각도
const BASE_SENSITIVITY = 0.003

export const radiansPerPixel = (s: Settings) => BASE_SENSITIVITY * s.sensitivity

const within = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && v >= min && v <= max

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
  }
}
