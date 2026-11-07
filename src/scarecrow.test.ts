import { describe, expect, test } from 'vitest'
import { makeAimingFrames, makeFallenFrames, makeScarecrowFrames, makeSuicideFrames, SUICIDE_AIM, SUICIDE_FLASH, suicideStage } from './scarecrow.ts'

const differs = (a: Uint32Array, b: Uint32Array) => a.some((c, i) => c !== b[i])

describe('makeAimingFrames', () => {
  const plain = makeScarecrowFrames()
  const aiming = makeAimingFrames()
  const firing = makeAimingFrames(true)

  test('8방향이고 서 있는 그림과 크기가 같음', () => {
    expect(aiming).toHaveLength(8)
    for (const [k, f] of aiming.entries()) expect([f.w, f.h]).toEqual([plain[k].w, plain[k].h])
  })

  test('등을 바로 보이지 않으면 든 총이 보임', () => {
    for (const k of [0, 1, 2, 3, 5, 6, 7]) expect(differs(aiming[k].pixels, plain[k].pixels)).toBe(true)
  })

  test('등을 바로 보이면 총이 몸에 가려 서 있는 그림과 같음', () => {
    expect(aiming[4].pixels).toEqual(plain[4].pixels)
  })

  test('나를 보거나 옆으로 서서 쏘면 불꽃이 보임', () => {
    for (const k of [0, 2, 6]) expect(differs(firing[k].pixels, aiming[k].pixels)).toBe(true)
  })

  test('등을 바로 보이고 쏘면 몸에 가려 불꽃이 안 보임', () => {
    expect(firing[4].pixels).toEqual(aiming[4].pixels)
  })
})

describe('makeSuicideFrames', () => {
  const plain = makeScarecrowFrames()
  const [aim, flash] = makeSuicideFrames()

  test('두 단계, 각 8방향', () => {
    expect(makeSuicideFrames()).toHaveLength(2)
    expect(aim).toHaveLength(8)
    expect(flash).toHaveLength(8)
  })

  test('나를 볼 때 머리에 댄 총이 보이고, 다음 단계에 불꽃이 더해짐', () => {
    expect(differs(aim[0].pixels, plain[0].pixels)).toBe(true)
    expect(differs(flash[0].pixels, aim[0].pixels)).toBe(true)
  })
})

describe('suicideStage', () => {
  test('총을 머리에 댄 뒤 불꽃, 그다음 쓰러진 그림', () => {
    expect(suicideStage(0)).toBe(0)
    expect(suicideStage(SUICIDE_AIM - 1)).toBe(0)
    expect(suicideStage(SUICIDE_AIM)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH - 1)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH)).toBeNull()
  })
})

describe('makeFallenFrames', () => {
  test('8방향 모두 그림이 있음', () => {
    const frames = makeFallenFrames()
    expect(frames).toHaveLength(8)
    for (const f of frames) expect(f.pixels.some((c) => c !== 0)).toBe(true)
  })

  test('바닥에 누워 있어 아래쪽 4분의 1에만 칠함', () => {
    const { w, h, pixels } = makeFallenFrames()[0]
    expect(pixels.subarray(0, w * Math.floor((h * 3) / 4)).every((c) => c === 0)).toBe(true)
  })
})
