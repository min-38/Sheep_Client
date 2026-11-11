import { describe, expect, test } from 'vitest'
import { BLEED, CARD_MS, endingAt, fallSlow, irisOpen, IRIS_MS, lastFallCamera, lastFallMotion, POSTER_MS, SLOW, STAMP_AT, STAMP_FALL, stampHitAt, walkerAt, walkoffCamera, WALKOFF_MS } from './ceremony.ts'
import { FALL_LAND_MS } from './character.ts'
import { POOL_MS } from './blood.ts'
import { fallDelay } from './sound.ts'
import { SUN_AZ } from './desert.ts'

const end = 100000
const SUN = (SUN_AZ * Math.PI) / 180
// 서버 RoundFlow.WinResultDuration
const WIN_RESULT_MS = 12000

describe('endingAt (SHEEP-169 시안 B)', () => {
  test('끝에서 거꾸로 자막 카드, 뒷모습, 포스터. 그 앞은 마지막 쓰러짐을 위에서 봄', () => {
    const card = end - CARD_MS
    const walk = card - WALKOFF_MS
    const poster = walk - POSTER_MS
    expect(endingAt(end, poster - 1).stage).toBe('top')
    expect(endingAt(end, poster)).toEqual({ stage: 'poster', elapsed: 0 })
    expect(endingAt(end, walk + 100)).toEqual({ stage: 'walk', elapsed: 100 })
    expect(endingAt(end, card)).toEqual({ stage: 'card', elapsed: 0 })
    expect(endingAt(end, end - 1).stage).toBe('card')
  })

  test('서버 승리 결과 12초 안에 위에서 보기 4초, 포스터 2.5초, 뒷모습 2.5초, 자막 카드 3초', () => {
    expect([POSTER_MS, WALKOFF_MS, CARD_MS]).toEqual([2500, 2500, 3000])
    expect(WIN_RESULT_MS - POSTER_MS - WALKOFF_MS - CARD_MS).toBe(4000)
  })
})

describe('lastFallMotion (사용자 요청 2026-11-11: 쓰러져 피 흘리는 데까지 느리게)', () => {
  test('바닥에 닿을 때까지는 SLOW배로 느리게, 닿은 뒤로는 피 웅덩이가 번지게 BLEED배로', () => {
    const land = FALL_LAND_MS / SLOW
    expect(lastFallMotion(1000, FALL_LAND_MS, SLOW)).toBeCloseTo(1000 * SLOW)
    expect(lastFallMotion(land, FALL_LAND_MS, SLOW)).toBeCloseTo(FALL_LAND_MS)
    expect(lastFallMotion(land + 500, FALL_LAND_MS, SLOW)).toBeCloseTo(FALL_LAND_MS + 500 * BLEED)
  })

  test('맞아 쓰러지면 위에서 보는 동안(결과가 정해지고 보이기까지 0.3초를 빼고) 바닥에 닿고 웅덩이가 다 자란 크기의 80%까지 번짐', () => {
    // 웅덩이 반지름은 1 - (1 - 지난 시간 / POOL_MS)² 몫 (blood.ts pool)
    const spread = POOL_MS * (1 - Math.sqrt(0.2))
    expect(fallDelay('shot') / fallSlow('shot') + spread / BLEED).toBeLessThanOrEqual(WIN_RESULT_MS - POSTER_MS - WALKOFF_MS - CARD_MS - 300)
  })

  test('시간 초과(자살)는 옆머리를 쏘는 동작부터라 길어, 더 빨리 틀어 위에서 보는 동안 바닥에 닿고 웅덩이가 80%까지 번짐 (SHEEP-172)', () => {
    const spread = POOL_MS * (1 - Math.sqrt(0.2))
    expect(fallDelay('timeout') / fallSlow('timeout') + spread / BLEED).toBeLessThanOrEqual(WIN_RESULT_MS - POSTER_MS - WALKOFF_MS - CARD_MS - 300)
    // 맞아 쓰러진 것은 지금처럼 느리게
    expect(fallSlow('shot')).toBe(SLOW)
  })
})

describe('stampHitAt (SHEEP-172 B안)', () => {
  test('포스터가 뜨고 STAMP_AT 뒤 떨어지기 시작해 STAMP_FALL 뒤 찍히고, 찍힌 도장이 1초 넘게 보임', () => {
    expect(endingAt(end, stampHitAt(end))).toEqual({ stage: 'poster', elapsed: STAMP_AT + STAMP_FALL })
    expect(POSTER_MS - (STAMP_AT + STAMP_FALL)).toBeGreaterThan(1000)
  })
})

describe('walkerAt', () => {
  test('해 쪽을 보고 해 쪽으로 걸어감', () => {
    const at0 = walkerAt(10, 10, 0)
    const later = walkerAt(10, 10, 2000)
    expect(at0).toEqual({ x: 10, y: 10, facing: SUN })
    const moved = Math.hypot(later.x - 10, later.y - 10)
    expect(moved).toBeGreaterThan(0.5)
    expect(Math.atan2(later.y - 10, later.x - 10)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
  })
})

describe('walkoffCamera', () => {
  test('이긴 사람 뒤에서 해 쪽을 봄', () => {
    const cam = walkoffCamera(10, 10, 66)
    expect(Math.atan2(cam.dirY, cam.dirX)).toBeCloseTo(Math.atan2(Math.sin(SUN), Math.cos(SUN)))
    // 이긴 사람이 카메라 앞에 있음
    expect((10 - cam.x) * cam.dirX + (10 - cam.y) * cam.dirY).toBeGreaterThan(1)
  })
})

describe('irisOpen', () => {
  test('자막 카드 앞 IRIS_MS 동안 다 열린 데서 다 닫히고, 카드 동안은 닫혀 있음', () => {
    const closed = end - CARD_MS
    expect(irisOpen(end, closed - IRIS_MS - 1)).toBe(1)
    expect(irisOpen(end, closed - IRIS_MS / 2)).toBeCloseTo(0.5)
    expect(irisOpen(end, closed)).toBe(0)
    expect(irisOpen(end, end)).toBe(0)
  })
})

describe('lastFallCamera', () => {
  test('쓰러지는 사람이 보던 쪽 앞 위에서 그 사람을 내려다보고, 천천히 물러나며 올라감', () => {
    for (const facing of [0, 1, 4]) {
      const first = lastFallCamera(10, 10, facing, 0, 66)
      const later = lastFallCamera(10, 10, facing, 3000, 66)
      for (const cam of [first, later]) {
        // 카메라는 바라보던 쪽 앞에 있고, 그 사람을 향해 내려다봄
        expect(Math.cos(facing) * (cam.x - 10) + Math.sin(facing) * (cam.y - 10)).toBeGreaterThan(1)
        expect(cam.dirX * Math.cos(facing) + cam.dirY * Math.sin(facing)).toBeCloseTo(-1)
        expect(cam.pitch).toBeLessThan(0)
      }
      expect(Math.hypot(later.x - 10, later.y - 10)).toBeGreaterThan(Math.hypot(first.x - 10, first.y - 10))
      expect(later.z!).toBeGreaterThan(first.z!)
    }
  })
})
