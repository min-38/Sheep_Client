import { describe, expect, test } from 'vitest'
import { AIM_PITCHES, characterFrames, pitchLevel, SCARVES, SUICIDE_AIM, SUICIDE_FLASH, suicideStage } from './character.ts'
import { BODY, HEAD } from './hitcard.ts'
import { PX_PER_CELL, type Sprite } from './sprite.ts'

const rgb = (c: number) => [c & 255, (c >> 8) & 255, (c >> 16) & 255]
const at = (s: Sprite, x: number, y: number) => s.pixels[y * s.w + x]
const differs = (a: Sprite, b: Sprite) => a.w !== b.w || a.h !== b.h || a.pixels.some((c, i) => c !== b.pixels[i])
// 바닥에서 위로 cells칸 높이인 줄 번호
const row = (s: Sprite, cells: number) => s.h - 1 - Math.floor(cells * PX_PER_CELL)
// (x, y)와 같은 색이 위아래로 이어진 줄 [위, 아래 다음]
function run(s: Sprite, x: number, y: number): [number, number] {
  const c = at(s, x, y)
  let top = y
  let bottom = y + 1
  while (top > 0 && at(s, x, top - 1) === c) top--
  while (bottom < s.h && at(s, x, bottom) === c) bottom++
  return [top, bottom]
}
// y줄에서 칠한 폭(px)
const width = (s: Sprite, y: number) => s.pixels.subarray(y * s.w, (y + 1) * s.w).filter((c) => c !== 0).length
// 바닥에서 위까지의 px 수가 칸 단위 높이와 1px 안에서 맞는지
const near = (px: number, cells: number) => expect(Math.abs(px - cells * PX_PER_CELL)).toBeLessThanOrEqual(1)

describe('characterFrames', () => {
  const red = characterFrames(0)
  const stand = red.stand[0]
  const mid = stand.w / 2
  // 정면을 보고 겨눈 그림
  const aim = red.aim[pitchLevel(0)]

  test('모든 동작이 8방향이고 빈 그림이 없음. 겨눈 그림과 발사는 위아래 단계마다 있음', () => {
    const sets = [red.stand, ...red.walk, ...red.aim, ...red.fire, ...red.suicide, red.fallen]
    expect(sets).toHaveLength(6 + 2 * AIM_PITCHES.length)
    for (const frames of sets) {
      expect(frames).toHaveLength(8)
      for (const f of frames) expect(f.pixels.some((c) => c !== 0)).toBe(true)
    }
  })

  test('서 있는 그림은 발이 바닥, 머리와 몸이 판정 원기둥과 같은 높이 (시스템 기획서 리볼버)', () => {
    expect(width(stand, stand.h - 1)).toBeGreaterThan(0)
    // 가운데 세로줄에서 얼굴색이 이어진 곳이 머리. 위는 모자 챙, 아래는 목수건이라 색이 다름
    const [top, bottom] = run(stand, mid, row(stand, (HEAD.top + BODY.top) / 2))
    near(stand.h - top, HEAD.top)
    near(stand.h - bottom, BODY.top)
  })

  test('몸과 팔을 합친 폭과 머리 폭이 판정 원기둥 지름과 같음', () => {
    near(width(stand, row(stand, BODY.top / 2 + 0.1)), BODY.radius * 2)
    near(width(stand, row(stand, (HEAD.top + BODY.top) / 2)), HEAD.radius * 2)
  })

  test('나를 보는 그림에만 눈이 있음 (frameIndex와 같은 순서)', () => {
    const dark = (s: Sprite) => {
      for (let y = row(s, HEAD.top) + 1; y <= row(s, BODY.top); y++)
        for (let x = 0; x < s.w; x++) if (at(s, x, y) !== 0 && Math.max(...rgb(at(s, x, y))) < 60) return true
      return false
    }
    expect(dark(red.stand[0])).toBe(true)
    expect(dark(red.stand[4])).toBe(false)
  })

  test('두 번째 장은 화면 왼쪽, 여섯 번째 장은 오른쪽을 봄 (시계 방향으로 90°, 270° 돎)', () => {
    // 겨눈 팔과 총이 바라보는 쪽으로 나옴
    const left = (s: Sprite) => s.pixels.filter((c, i) => c !== 0 && i % s.w < s.w / 2).length
    const right = (s: Sprite) => s.pixels.filter((c, i) => c !== 0 && i % s.w >= s.w / 2).length
    expect(left(aim[2])).toBeGreaterThan(right(aim[2]) * 1.2)
    expect(right(aim[6])).toBeGreaterThan(left(aim[6]) * 1.2)
  })

  test('위를 보면 옆에서 본 총구가 높고, 아래를 보면 낮음', () => {
    // 2번 장은 화면 왼쪽을 봐 겨눈 총이 가장 왼쪽에 나옴. 그 열에 칠한 칸들의 바닥에서 높이(px)
    const muzzle = (s: Sprite) => {
      for (let x = 0; x < s.w; x++) {
        const ys = [...Array(s.h).keys()].filter((y) => at(s, x, y) !== 0)
        if (ys.length > 0) return s.h - ys.reduce((a, b) => a + b) / ys.length
      }
      return NaN
    }
    const [down, , level, , up] = red.aim.map((frames) => muzzle(frames[2]))
    expect(up).toBeGreaterThan(level + 5)
    expect(down).toBeLessThan(level - 5)
  })

  test('위를 보면 머리가 들려 모자 꼭대기가 뒤로, 아래를 보면 앞으로 감', () => {
    // 2번 장은 화면 왼쪽이 앞. 가장 위 줄에 칠한 칸들의 가로 가운데(px)
    const top = (s: Sprite) => {
      const y = s.pixels.findIndex((c) => c !== 0) / s.w | 0
      const xs = [...Array(s.w).keys()].filter((x) => at(s, x, y) !== 0)
      return xs.reduce((a, b) => a + b) / xs.length - s.w / 2
    }
    const [down, , level, , up] = red.aim.map((frames) => top(frames[2]))
    expect(up).toBeGreaterThan(level + 3)
    expect(down).toBeLessThan(level - 3)
  })

  test('목수건은 들어온 순서의 색 (시스템 기획서 사람 색)', () => {
    expect(SCARVES).toEqual([0xd83a3a, 0x4fb3e8, 0x34a853, 0xf2cf2a, 0xf08a1c, 0xee77b8, 0xf4f4f4, 0x2a2a2a])
    for (const [i, hex] of SCARVES.entries()) {
      const s = characterFrames(i).stand[0]
      // 목에 두른 띠의 앞면. 면 밝기만 곱해지므로 세 채널 비율이 정한 색과 같음
      const got = rgb(at(s, s.w / 2, row(s, BODY.top - 0.03)))
      const want = [hex >> 16, (hex >> 8) & 255, hex & 255]
      const k = Math.max(...got) / Math.max(...want)
      for (let c = 0; c < 3; c++) expect(Math.abs(got[c] - want[c] * k)).toBeLessThanOrEqual(1.5)
    }
  })

  test('색이 달라도 목수건 말고는 같은 그림', () => {
    const blue = characterFrames(1).stand[0]
    const changed = [...stand.pixels.keys()].filter((i) => stand.pixels[i] !== blue.pixels[i]).map((i) => Math.floor(i / stand.w))
    expect(changed.length).toBeGreaterThan(0)
    expect(Math.min(...changed)).toBeGreaterThan(row(stand, BODY.top) - 2)
    expect(Math.max(...changed)).toBeLessThan(row(stand, BODY.top - 0.2))
  })

  test('같은 색은 한 번만 만듦', () => {
    expect(characterFrames(0)).toBe(red)
  })

  test('걷기 두 장은 옆에서 볼 때 다리가 다름', () => {
    expect(differs(red.walk[0][2], red.walk[1][2])).toBe(true)
  })

  test('쏘면 팔이 들리고 불꽃이 보임', () => {
    for (const [i, frames] of red.fire.entries()) for (const k of [0, 2, 6]) expect(differs(frames[k], red.aim[i][k])).toBe(true)
  })

  test('자살 모습은 나를 볼 때 머리에 댄 총이 보이고, 다음 단계에 불꽃이 더해짐', () => {
    const [aim, flash] = red.suicide
    expect(differs(aim[0], stand)).toBe(true)
    expect(differs(flash[0], aim[0])).toBe(true)
  })

  test('쓰러지면 옆으로 누워 몸 폭만큼만 높음', () => {
    for (const f of red.fallen) near(f.h, BODY.radius * 2)
    expect(red.fallen[0].w).toBeGreaterThan(red.fallen[0].h * 2)
  })
})

describe('pitchLevel', () => {
  test('위아래 시선을 가장 가까운 단계로 고르고, 범위 밖은 끝 단계 (시스템 기획서 조작 위아래 보기)', () => {
    expect(AIM_PITCHES).toEqual([-0.5, -0.25, 0, 0.25, 0.5])
    expect(pitchLevel(0)).toBe(2)
    expect(pitchLevel(0.5)).toBe(4)
    expect(pitchLevel(-0.5)).toBe(0)
    expect(pitchLevel(0.13)).toBe(3)
    expect(pitchLevel(0.12)).toBe(2)
    expect(pitchLevel(-0.2)).toBe(1)
    expect(pitchLevel(9)).toBe(4)
    expect(pitchLevel(-9)).toBe(0)
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
