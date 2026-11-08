import { t } from './i18n/index.ts'
import type { ShotResult } from './net.ts'

// 칸. 몸과 머리 판정 원기둥의 반지름과 윗면 높이. 서버 HitScan(BodyRadius, BodyTop, HeadRadius, HeadTop)과 같은 값이어야
// 총알 구멍이 맞은 자리에 찍힘. ponytail: 임시 값(시스템 기획서 리볼버). 플레이해 보며 정함
// 7.5등신 틀(시스템 기획서 캐릭터)에서 잼: 몸 위는 머리 밑, 몸 반지름은 팔 바깥, 머리 반지름은 머리 폭
export const BODY = { radius: 0.15, top: 0.78 }
export const HEAD = { radius: 0.05, top: 0.9 }

// 카드의 도장 문구
export function resultLabel(r: Pick<ShotResult, 'zone' | 'down'>): string {
  if (r.zone === 'head') return t.hud.head
  if (r.zone === 'body') return r.down ? t.hud.hitDown : t.hud.wounded
  return t.hud.miss
}

// 카드의 몸 그림(SVG viewBox 0..100)에서 구멍 자리. 높이 0이 아래(100), 머리 위가 위(0).
// 가로도 같은 배율이라 몸 모양의 비율이 판정 원기둥과 같음
export function dotPosition(offset: number, height: number): { x: number; y: number } {
  const scale = 100 / HEAD.top
  return { x: 50 + offset * scale, y: 100 - height * scale }
}

// 반샷 혈흔. atRoundStart는 이번 라운드 걷기가 시작할 때 켜져 있었는지임.
// 함께 쓰러져 다시 서면 서버가 반샷을 그 라운드 전으로 되돌리므로 혈흔도 그 값으로 되돌림 (컨셉 기획서 규칙 함께 쓰러짐)
export type Blood = { shown: boolean; atRoundStart: boolean }

export const noBlood: Blood = { shown: false, atRoundStart: false }

export const onWalk = (b: Blood): Blood => ({ ...b, atRoundStart: b.shown })

export const onWounded = (b: Blood): Blood => ({ ...b, shown: true })

export const onRevived = (b: Blood): Blood => ({ ...b, shown: b.atRoundStart })

// 판이 끝나면 반샷이 모두 사라짐
export const onGameEnd = (): Blood => noBlood
