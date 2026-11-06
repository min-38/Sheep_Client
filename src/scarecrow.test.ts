import { describe, expect, test } from 'vitest'
import { makeFallenFrames, makeScarecrowFrames } from './scarecrow.ts'

const differs = (a: Uint32Array, b: Uint32Array) => a.some((c, i) => c !== b[i])

describe('makeScarecrowFrames', () => {
  const plain = makeScarecrowFrames()
  const firing = makeScarecrowFrames(true)

  test('나를 보고 쏘면 불꽃이 보임', () => {
    expect(differs(firing[0].pixels, plain[0].pixels)).toBe(true)
  })

  test('옆으로 서서 쏴도 불꽃이 보임', () => {
    expect(differs(firing[2].pixels, plain[2].pixels)).toBe(true)
    expect(differs(firing[6].pixels, plain[6].pixels)).toBe(true)
  })

  test('등을 보이고 쏘면 몸에 가려 불꽃이 안 보임', () => {
    for (const k of [3, 4, 5]) expect(firing[k].pixels).toEqual(plain[k].pixels)
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
