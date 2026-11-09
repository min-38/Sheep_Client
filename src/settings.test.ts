import { describe, expect, test } from 'vitest'
import { CROSSHAIRS, DEFAULT_SETTINGS, radiansPerPixel, readSettings } from './settings.ts'

describe('readSettings', () => {
  test.each([null, '', '깨진 글', '42', 'null', '[]'])('없거나 깨진 값 %j는 기본값', (raw) => {
    expect(readSettings(raw)).toEqual(DEFAULT_SETTINGS)
  })

  test('기억한 값을 그대로 읽음', () => {
    const saved = { sensitivity: 2.5, music: 0.3, effects: 0, hand: 'left', language: 'ko', crosshair: 'cross' }
    expect(readSettings(JSON.stringify(saved))).toEqual(saved)
  })

  test('범위 밖이거나 모양이 틀린 칸만 기본값', () => {
    const raw = JSON.stringify({ sensitivity: 5, music: -0.1, effects: '1', hand: 'up', language: 'fr', crosshair: 'star' })
    expect(readSettings(raw)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings(JSON.stringify({ sensitivity: 0.25, effects: 1 }))).toEqual({ ...DEFAULT_SETTINGS, sensitivity: 0.25 })
  })

  test('기본값은 감도 100%, 배경음악 60%, 효과음 100%, 오른손, 영어, 고리와 점', () => {
    expect(DEFAULT_SETTINGS).toEqual({ sensitivity: 1, music: 0.6, effects: 1, hand: 'right', language: 'en', crosshair: 'ringDot' })
  })

  test('조준점 모양은 고리와 점, 십자, 점, 고리 넷 중 하나이고 그 밖의 값은 기본 모양', () => {
    expect(CROSSHAIRS).toEqual(['ringDot', 'cross', 'dot', 'ring'])
    for (const crosshair of CROSSHAIRS) expect(readSettings(JSON.stringify({ crosshair })).crosshair).toBe(crosshair)
    for (const crosshair of ['', 'Cross', 'toString', 1, null]) expect(readSettings(JSON.stringify({ crosshair })).crosshair).toBe('ringDot')
  })
})

describe('radiansPerPixel', () => {
  test('감도 100%는 0.003 rad/px이고 배율만큼 늘고 줆', () => {
    expect(radiansPerPixel(DEFAULT_SETTINGS)).toBeCloseTo(0.003)
    expect(radiansPerPixel({ ...DEFAULT_SETTINGS, sensitivity: 4 })).toBeCloseTo(0.012)
    expect(radiansPerPixel({ ...DEFAULT_SETTINGS, sensitivity: 0.25 })).toBeCloseTo(0.00075)
  })
})
