import { describe, expect, test } from 'vitest'
import { CELL } from './character.ts'
import { BODY, dotPosition, HEAD, noBlood, onGameEnd, onRevived, onWalk, onWounded, resultLabel } from './hitcard.ts'

describe('resultLabel', () => {
  test('머리는 즉사, 몸은 반샷이거나 쓰러짐, 못 맞히면 빗나감', () => {
    expect(resultLabel({ zone: 'head', down: true })).toBe('머리 즉사')
    expect(resultLabel({ zone: 'body', down: false })).toBe('반샷')
    expect(resultLabel({ zone: 'body', down: true })).toBe('쓰러짐')
    expect(resultLabel({ zone: null, down: false })).toBe('빗나감')
  })
})

describe('판정 원기둥', () => {
  test('서버 HitScan과 같은 값 (시스템 기획서 리볼버 머리·몸 판정 크기)', () => {
    expect(HEAD).toEqual({ radius: 0.05, top: 0.9 })
    expect(BODY).toEqual({ radius: 0.15, top: 0.78 })
  })

  test('7.5등신 틀에 맞음: 몸 위는 머리 밑(26블록), 몸 반지름은 팔 바깥(5블록), 머리 반지름은 머리 폭(1.5블록)과 1px 안', () => {
    expect(BODY.top).toBeCloseTo(26 * CELL)
    expect(BODY.radius).toBeCloseTo(5 * CELL)
    expect(Math.abs(HEAD.radius - 1.5 * CELL)).toBeLessThanOrEqual(0.015)
  })
})

describe('dotPosition', () => {
  test('바닥은 카드 맨 아래, 머리 위는 맨 위, 가운데는 가운데', () => {
    expect(dotPosition(0, HEAD.top)).toEqual({ x: 50, y: 0 })
    expect(dotPosition(0, 0)).toEqual({ x: 50, y: 100 })
  })

  test('쏜 사람 기준 오른쪽에 맞으면 카드 오른쪽에 찍음', () => {
    expect(dotPosition(BODY.radius, 0.3).x).toBeGreaterThan(50)
    expect(dotPosition(-BODY.radius, 0.3).x).toBeLessThan(50)
  })

  test('몸 가장자리도 카드 안에 들어옴', () => {
    const edge = dotPosition(BODY.radius, BODY.top)
    expect(edge.x).toBeLessThan(100)
    expect(edge.y).toBeGreaterThan(0)
  })
})

describe('혈흔', () => {
  test('반샷을 맞으면 켬', () => {
    expect(onWounded(onWalk(noBlood)).shown).toBe(true)
  })

  test('blood_WoundedThenRevived_RevertsToRoundStart: 이번 라운드에 맞고 함께 쓰러져 다시 서면 그 라운드 전으로 되돌림', () => {
    expect(onRevived(onWounded(onWalk(noBlood))).shown).toBe(false)
  })

  test('blood_WoundedLastRound_StaysAfterRevive: 지난 라운드의 반샷은 되살아나도 남음', () => {
    const lastRound = onWounded(onWalk(noBlood))
    expect(onRevived(onWalk(lastRound)).shown).toBe(true)
  })

  test('판이 끝나면 모두 지움', () => {
    expect(onGameEnd().shown).toBe(false)
  })
})
