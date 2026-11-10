import { describe, expect, test } from 'vitest'
import { CROSSHAIRS, DEFAULT_SETTINGS, RADIANS_PER_PIXEL, readSettings } from './settings.ts'

describe('readSettings', () => {
  test.each([null, '', '깨진 글', '42', 'null', '[]'])('없거나 깨진 값 %j는 기본값', (raw) => {
    expect(readSettings(raw)).toEqual(DEFAULT_SETTINGS)
  })

  test('기억한 값을 그대로 읽음', () => {
    const saved = { music: 0.3, effects: 0, hand: 'left', language: 'ko', crosshair: 'cross' }
    expect(readSettings(JSON.stringify(saved))).toEqual(saved)
  })

  test('범위 밖이거나 모양이 틀린 칸만 기본값', () => {
    const raw = JSON.stringify({ music: -0.1, effects: '1', hand: 'up', language: 'fr', crosshair: 'star' })
    expect(readSettings(raw)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings(JSON.stringify({ music: 0.25, effects: 1 }))).toEqual({ ...DEFAULT_SETTINGS, music: 0.25 })
  })

  test('기본값은 배경음악 60%, 효과음 100%, 오른손, 영어, 고리와 점', () => {
    expect(DEFAULT_SETTINGS).toEqual({ music: 0.6, effects: 1, hand: 'right', language: 'en', crosshair: 'ringDot' })
  })

  test('예전에 기억한 감도는 읽지 않음 (SHEEP-157)', () => {
    expect(readSettings(JSON.stringify({ sensitivity: 4, music: 0.3 }))).toEqual({ ...DEFAULT_SETTINGS, music: 0.3 })
  })

  test('조준점 모양은 고리와 점, 십자, 점, 고리 넷 중 하나이고 그 밖의 값은 기본 모양', () => {
    expect(CROSSHAIRS).toEqual(['ringDot', 'cross', 'dot', 'ring'])
    for (const crosshair of CROSSHAIRS) expect(readSettings(JSON.stringify({ crosshair })).crosshair).toBe(crosshair)
    for (const crosshair of ['', 'Cross', 'toString', 1, null]) expect(readSettings(JSON.stringify({ crosshair })).crosshair).toBe('ringDot')
  })
})

describe('RADIANS_PER_PIXEL', () => {
  test('모두 같은 감도 0.002 rad/px로 돎. 예전 기본 0.003보다 낮음 (SHEEP-157)', () => {
    expect(RADIANS_PER_PIXEL).toBe(0.002)
  })
})
