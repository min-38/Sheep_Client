import { t } from './i18n/index.ts'
import type { Phase, RoundResult } from './net.ts'

// 서버가 알린 판 단계별 시작 시각(ms, 서버 시계). 아직 알림받지 않은 단계는 없음
export type Schedule = Partial<Record<Phase, number>>

// ms. "시작!"을 띄워 두는 시간. ponytail: 임시 값. 시스템 기획서 HUD에서 정하면 그 값으로 바꿈
export const GO_SHOWN = 1000

// now(서버 시계)에 화면에 띄울 글자. 없으면 ''. 카운트다운은 걷기 시각까지 3, 2, 1을 같은 간격으로 (기술 설계서 메시지 phase)
export function banner(s: Schedule, now: number): string {
  if (s.duel !== undefined && now >= s.duel) return now < s.duel + GO_SHOWN ? t.hud.go : ''
  if (s.countdown === undefined || now < s.countdown || (s.walk !== undefined && now >= s.walk)) return ''
  // 걷기 시각은 카운트다운이 시작할 때 오므로 그 전에는 3
  if (s.walk === undefined) return '3'
  return String(3 - Math.floor(((now - s.countdown) * 3) / (s.walk - s.countdown)))
}

// ms. 결투 시각("시작!")부터 쏠 수 있는 시간. 서버 RoundFlow.DuelLimit과 같은 값이어야 남은 시간이 0일 때 서버가 시간 초과를 정함.
// ponytail: 임시 값(시스템 기획서 판 흐름 시간). 플레이해 보며 정함
export const DUEL_LIMIT = 10000

// now(서버 시계)에 남은 시간(ms). 결투 시각 전에는 null, 제한 시각이 지나면 0
export const timeLeft = (s: Schedule, now: number): number | null =>
  s.duel === undefined || now < s.duel ? null : Math.max(0, s.duel + DUEL_LIMIT - now)

// t(내 시계)에 서 있는 사람 수 (시스템 기획서 HUD 남은 인원). 쓰러진 그림이 보이는 시각(탈락을 받은 시각)부터 뺌.
// 앞 라운드에 쓰러져 재대결에 끼지 못한 사람도 downs에 남아 빠짐
export const standingCount = (ids: Iterable<string>, downs: ReadonlyMap<string, { at: number }>, t: number) =>
  [...ids].filter((id) => !((downs.get(id)?.at ?? Infinity) <= t)).length

// 남은 시간 글자 "0:07". 초를 올림해 0:00은 정말 끝났을 때만 보임
export function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ms. 걷기 시각에 제자리에서 바깥으로 뒤도는 시간. 그 뒤에 걸음. 서버 RoundFlow.TurnDuration과 같아야 함 (SHEEP-120).
// ponytail: 임시 값(시스템 기획서 판 흐름 시간). 플레이해 보며 정함
export const TURN_MS = 1000

// ms. 걸음 간격(발소리 간격). 서버 RoundFlow.StepInterval과 같아야 함 (사용자 결정 2026-11-10, SHEEP-120)
export const STEP_MS = 500

// 모두 멈추지 않고 걷는 걸음 수 (사용자 결정 2026-11-09, SHEEP-120)
export const STEPS = 10

// ms. 다 돈 뒤 걷는 시간. 서버 RoundFlow.WalkDuration과 같아야 발소리가 걸음과 맞음
export const WALK_DURATION = STEPS * STEP_MS

// now(서버 시계)에 걷는 중인지. 뒤도는 동안과, 다 걷고 결투 시각을 기다리는 동안은 아님
export const walking = (s: Schedule, now: number) => s.walk !== undefined && now >= s.walk + TURN_MS && now < s.walk + TURN_MS + WALK_DURATION

// 걷기 시각부터 t까지 몇 번째 걸음인지. 다 돈 뒤부터 셈. 걸음 번호가 늘 때 발소리를 냄
export const stepIndex = (walkAt: number, t: number) => Math.floor((t - walkAt - TURN_MS) / STEP_MS)

// 카운트다운부터 "시작!"까지 내 돌기와 발사를 막음. 그동안은 서버가 나를 돌리고 걷게 함 (기술 설계서 서버/클라 역할 분리)
export const locked = (s: Schedule, now: number) =>
  s.countdown !== undefined && now >= s.countdown && !(s.duel !== undefined && now >= s.duel)

// "시작!"부터 쏠 수 있음. 그 전 발사는 서버가 버리므로 불꽃도 탄 수도 바꾸지 않음
export const dueling = (s: Schedule, now: number) => s.duel !== undefined && now >= s.duel

// 판 결과 글자. 플레이어 이름이 없어 나를 기준으로 씀. 결과 화면 꾸미기(M6)에서 바꿈
export function resultText(r: RoundResult, myId: string | null): string {
  if (r.outcome === 'rematch') return t.hud.rematch(r.playerIds.length)
  return r.playerIds[0] === myId ? t.hud.win : t.hud.lose
}

// 카운트다운을 받을 때 그 라운드에 myId가 끼는지. prev는 바로 앞 판 결과이고, 재대결이면 그 playerIds만 끼고 다시 장전함
export const joins = (prev: RoundResult | null, myId: string) => prev?.outcome !== 'rematch' || prev.playerIds.includes(myId)
