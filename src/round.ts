import type { Phase, RoundResult } from './net.ts'

// 서버가 알린 판 단계별 시작 시각(ms, 서버 시계). 아직 알림받지 않은 단계는 없음
export type Schedule = Partial<Record<Phase, number>>

// ms. "시작!"을 띄워 두는 시간. ponytail: 임시 값. 시스템 기획서 HUD에서 정하면 그 값으로 바꿈
export const GO_SHOWN = 1000

// now(서버 시계)에 화면에 띄울 글자. 없으면 ''. 카운트다운은 걷기 시각까지 3, 2, 1을 같은 간격으로 (기술 설계서 메시지 phase)
export function banner(s: Schedule, now: number): string {
  if (s.duel !== undefined && now >= s.duel) return now < s.duel + GO_SHOWN ? '시작!' : ''
  if (s.countdown === undefined || now < s.countdown || (s.walk !== undefined && now >= s.walk)) return ''
  // 걷기 시각은 카운트다운이 시작할 때 오므로 그 전에는 3
  if (s.walk === undefined) return '3'
  return String(3 - Math.floor(((now - s.countdown) * 3) / (s.walk - s.countdown)))
}

// 카운트다운부터 "시작!"까지 내 돌기와 발사를 막음. 그동안은 서버가 나를 돌리고 걷게 함 (기술 설계서 서버/클라 역할 분리)
export const locked = (s: Schedule, now: number) =>
  s.countdown !== undefined && now >= s.countdown && !(s.duel !== undefined && now >= s.duel)

// "시작!"부터 쏠 수 있음. 그 전 발사는 서버가 버리므로 불꽃도 탄 수도 바꾸지 않음
export const dueling = (s: Schedule, now: number) => s.duel !== undefined && now >= s.duel

// 판 결과 글자. 플레이어 이름이 없어 나를 기준으로 씀. ponytail: 임시 문구. 결과 화면 꾸미기(M6)에서 바꿈
export function resultText(r: RoundResult, myId: string | null): string {
  if (r.outcome === 'rematch') return `재대결 ${r.playerIds.length}명`
  return r.playerIds[0] === myId ? '승리!' : '패배'
}
