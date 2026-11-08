import { describe, expect, test } from 'vitest'
import { CELL, characterBody, corners, drawFigure, SCARVES, SUICIDE_AIM, SUICIDE_FLASH, suicideStage, walkSwing, type Box } from './character.ts'
import { BODY, HEAD } from './hitcard.ts'
import { makeCamera, type RGB } from './render.ts'
import { STEP_MS } from './round.ts'

type V = readonly [number, number, number]

// 상자들이 덮는 i축 범위(칸)
function span(boxes: readonly Box[], i: number): [number, number] {
  const values = boxes.flatMap((b) => corners(b).map((p) => p[i] * CELL))
  return [Math.min(...values), Math.max(...values)]
}
// p(블록)를 품은 상자들
const holding = (boxes: readonly Box[], p: V) =>
  boxes.filter((b) => b.axes.every((a, i) => Math.abs(a.reduce((s, ai, j) => s + ai * (p[j] - b.c[j]), 0)) <= b.half[i]))
// 칸 단위 길이가 1px(PX 64px/키) 안에서 맞는지
const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(0.015)

describe('characterBody', () => {
  const red = characterBody(0)
  const stand = red.stand

  test('서 있으면 발이 바닥, 머리가 판정 원기둥과 같은 높이와 폭 (시스템 기획서 리볼버)', () => {
    near(span(stand, 1)[0], 0)
    const head = holding(stand, [0, 28, 0])
    expect(head).toHaveLength(1)
    const [bottom, top] = span(head, 1)
    near(bottom, BODY.top)
    near(top, HEAD.top)
    near(span(head, 0)[1], HEAD.radius)
  })

  test('몸과 팔을 합친 폭이 판정 원기둥 지름과 같음', () => {
    const [left, right] = span(stand.filter((b) => b.c[1] > 12 && b.c[1] < 24), 0)
    near(left, -BODY.radius)
    near(right, BODY.radius)
  })

  test('목수건은 들어온 순서의 색이고, 색이 달라도 목수건 말고는 같은 상자 (시스템 기획서 사람 색)', () => {
    expect(SCARVES).toEqual([0xd83a3a, 0x4fb3e8, 0x34a853, 0xf2cf2a, 0xf08a1c, 0xee77b8, 0xf4f4f4, 0x2a2a2a])
    const rgb = (hex: number) => [hex >> 16, (hex >> 8) & 255, hex & 255]
    for (const [i, hex] of SCARVES.entries()) expect(characterBody(i).stand.some((b) => `${b.rgb}` === `${rgb(hex)}`)).toBe(true)
    const blue = characterBody(1).stand
    const changed = stand.filter((b, i) => `${b.rgb}` !== `${blue[i].rgb}`)
    expect(changed.length).toBeGreaterThan(0)
    for (const b of changed) expect(`${b.rgb}`).toBe(`${rgb(SCARVES[0])}`)
  })

  test('같은 색은 한 번만 만듦', () => {
    expect(characterBody(0)).toBe(red)
  })

  test('걸을 때 흔드는 쪽에 따라 다리가 다름', () => {
    expect(red.walk(0.4)).not.toEqual(red.walk(-0.4))
  })

  test('쏘면 팔이 들리고 불꽃 상자가 더해짐', () => {
    for (const pitch of [-0.5, 0, 0.5]) {
      expect(red.fire(pitch).length).toBe(red.aim(pitch).length + 1)
      expect(red.fire(pitch).slice(0, -1)).not.toEqual(red.aim(pitch))
    }
  })

  test('정면을 보면 머리가 서 있을 때와 같은 자리', () => {
    expect(holding(red.aim(0), [0, 28, 0])).toEqual(holding(stand, [0, 28, 0]))
  })

  test('위를 보면 총구가 높고, 아래를 보면 낮음 (시스템 기획서 조작 다른 사람의 위아래 시선)', () => {
    // 가장 앞으로 나온 꼭짓점(총구)의 높이(블록)
    const muzzle = (boxes: readonly Box[]) => corners(boxes.reduce((a, b) => (Math.max(...corners(b).map((p) => p[2])) > Math.max(...corners(a).map((p) => p[2])) ? b : a)))
    const height = (pitch: number) => Math.max(...muzzle(red.aim(pitch)).map((p) => p[1]))
    expect(height(0.5)).toBeGreaterThan(height(0) + 3)
    expect(height(-0.5)).toBeLessThan(height(0) - 3)
  })

  test('위를 보면 머리가 들려 모자 꼭대기가 뒤로, 아래를 보면 앞으로 감', () => {
    // 가장 높은 상자(모자 꼭대기)의 앞뒤 자리(블록)
    const crown = (pitch: number) => red.aim(pitch).reduce((a, b) => (b.c[1] > a.c[1] ? b : a)).c[2]
    expect(crown(0)).toBeCloseTo(0)
    expect(crown(0.5)).toBeLessThan(-3)
    expect(crown(-0.5)).toBeGreaterThan(3)
  })

  test('자살 모습은 머리에 총을 대고, 다음 단계에 불꽃이 더해짐', () => {
    const [aim, flash] = red.suicide
    expect(aim).not.toEqual(stand)
    expect(flash.length).toBe(aim.length + 1)
  })

  test('쓰러지면 바닥에 옆으로 누워 몸 폭만큼만 높음', () => {
    const [bottom, top] = span(red.fallen, 1)
    near(bottom, 0)
    near(top, BODY.radius * 2)
    const [left, right] = span(red.fallen, 0)
    expect(right - left).toBeGreaterThan((top - bottom) * 2)
  })
})

describe('walkSwing', () => {
  test('걸음마다 다리가 번갈아 가장 앞에 오고, 그 사이는 이어서 흔듦', () => {
    expect(walkSwing(0)).toBeGreaterThan(0)
    expect(walkSwing(STEP_MS)).toBeCloseTo(-walkSwing(0))
    expect(walkSwing(2 * STEP_MS)).toBeCloseTo(walkSwing(0))
    expect(walkSwing(STEP_MS / 2)).toBeCloseTo(0)
  })
})

describe('drawFigure', () => {
  const W = 400
  const H = 200
  // 시야 90°면 plane 길이가 1이라 proj가 W/2
  const cam = makeCamera(0, 0, 0, 90)
  const WHITE: RGB = [255, 255, 255]
  const body = characterBody(0)

  function draw(x: number, facing: number, boxes = body.stand, zbuf = new Float64Array(W).fill(Infinity), light = WHITE) {
    const pixels = new Uint32Array(W * H)
    drawFigure(pixels, W, H, zbuf, cam, { x, y: 0, facing, boxes }, light)
    return pixels
  }
  const columns = (pixels: Uint32Array) => [...Array(W).keys()].filter((x) => [...Array(H).keys()].some((y) => pixels[y * W + x] !== 0))
  // 거리 d에서 높이 z(칸)가 그려지는 줄. 눈높이 0.5가 지평선(H/2)
  const rowAt = (z: number, d: number) => H / 2 + ((W / 2) * (0.5 - z)) / d

  test('나를 보면 얼굴에 눈이 보이고, 등지면 안 보임', () => {
    // 얼굴 앞면까지의 거리. 판정 원기둥 사이 얼굴 높이의 줄만 봄
    const d = 2 - HEAD.radius
    const dark = (pixels: Uint32Array) => {
      for (let y = Math.ceil(rowAt(HEAD.top - 0.03, d)); y < rowAt(BODY.top + 0.03, d); y++)
        for (let x = 0; x < W; x++) {
          const c = pixels[y * W + x]
          if (c !== 0 && Math.max(c & 255, (c >> 8) & 255, (c >> 16) & 255) < 60) return true
        }
      return false
    }
    expect(dark(draw(2, Math.PI))).toBe(true)
    expect(dark(draw(2, 0))).toBe(false)
  })

  test('나를 보면 그 사람의 오른쪽 엉덩이(권총집)가 화면 왼쪽에 보임', () => {
    const pixels = draw(2, Math.PI)
    // 엉덩이 높이(8블록) 줄에서 칠한 양 끝
    const y = Math.round(rowAt(8 * CELL, 2))
    const cols = [...Array(W).keys()].filter((x) => pixels[y * W + x] !== 0)
    expect(W / 2 - cols[0]).toBeGreaterThan(cols[cols.length - 1] + 1 - W / 2 + 2)
  })

  test('45°마다 끊기지 않고 조금만 돌아도 다르게 보임', () => {
    expect(draw(4, Math.PI + 0.2)).not.toEqual(draw(4, Math.PI))
  })

  test('시계 방향으로 90° 돌면 겨눈 팔이 화면 왼쪽으로 나옴', () => {
    const pixels = draw(4, (3 * Math.PI) / 2, body.aim(0))
    const cols = columns(pixels)
    const left = cols.filter((x) => x < W / 2).length
    const right = cols.filter((x) => x >= W / 2).length
    expect(left).toBeGreaterThan(right * 1.2)
  })

  test('정면에 서면 화면 가운데, 발은 벽 아래 끝과 같은 높이', () => {
    const pixels = draw(4, Math.PI)
    const cols = columns(pixels)
    expect(Math.abs((cols[0] + cols[cols.length - 1] + 1) / 2 - W / 2)).toBeLessThanOrEqual(1)
    let bottom = 0
    for (let y = 0; y < H; y++) if (pixels[y * W + W / 2] !== 0) bottom = y + 1
    expect(Math.abs(bottom - rowAt(0, 4))).toBeLessThanOrEqual(1.5)
  })

  test('벽이 더 가까운 가로줄에는 그리지 않음', () => {
    const zbuf = new Float64Array(W).fill(Infinity).fill(2, 0, W / 2)
    const cols = columns(draw(4, Math.PI, body.stand, zbuf))
    expect(cols.length).toBeGreaterThan(0)
    expect(cols[0]).toBe(W / 2)
  })

  test('카메라 뒤에 있으면 그리지 않음', () => {
    expect(columns(draw(-4, 0))).toEqual([])
  })

  test('빛 색조를 곱해 칠함', () => {
    const pixels = draw(4, Math.PI, body.stand, undefined, [255, 255, 0])
    const drawn = pixels.filter((c) => c !== 0)
    expect(drawn.length).toBeGreaterThan(0)
    for (const c of drawn) expect((c >> 16) & 255).toBe(0)
  })
})

describe('suicideStage', () => {
  test('총을 머리에 댄 뒤 불꽃, 그다음 쓰러진 모습', () => {
    expect(suicideStage(0)).toBe(0)
    expect(suicideStage(SUICIDE_AIM - 1)).toBe(0)
    expect(suicideStage(SUICIDE_AIM)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH - 1)).toBe(1)
    expect(suicideStage(SUICIDE_AIM + SUICIDE_FLASH)).toBeNull()
  })
})
