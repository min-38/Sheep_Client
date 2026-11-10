import { describe, expect, test } from 'vitest'
import { makeCamera, pack, type RGB } from './render.ts'
import { drawSprites, frameIndex, PX_PER_CELL, type Sprite, type Thing } from './sprite.ts'

const W = 400
const H = 200
// 시야 90°면 plane 길이가 1이라 계산이 쉬움
const cam = makeCamera(0, 0, 0, 90)
const RED = 0xff0000ff
const BLUE = 0xffff0000
const WHITE: RGB = [255, 255, 255]
// 8방향 모두 같은 그림. 한 픽셀을 가로세로 약 1칸으로 늘림
const N = Math.round(PX_PER_CELL)
const eight = (w: number, ...pixels: number[]): Sprite[] =>
  Array(8).fill({ w: w * N, h: N, pixels: new Uint32Array(w * N * N).map((_, i) => pixels[Math.floor((i % (w * N)) / N)]) })
const solid = (color: number) => eight(1, color)
const at = (x: number, y: number, frames = solid(RED)): Thing => ({ x, y, facing: 0, frames })

function draw(things: Thing[], zbuf = new Float64Array(W).fill(Infinity), camera = cam, light = WHITE) {
  const pixels = new Uint32Array(W * H)
  drawSprites(pixels, W, H, zbuf, camera, things, light)
  return pixels
}

// 가운데 세로줄에서 칠한 가장 아래 줄 다음 번호
function bottomRow(pixels: Uint32Array) {
  let bottom = 0
  for (let y = 0; y < H; y++) if (pixels[y * W + W / 2] !== 0) bottom = y + 1
  return bottom
}

// 무언가 그려진 가로줄 번호들
function columns(pixels: Uint32Array) {
  const cols: number[] = []
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (pixels[y * W + x] !== 0) {
        cols.push(x)
        break
      }
    }
  }
  return cols
}

const mid = (cols: number[]) => (cols[0] + cols[cols.length - 1] + 1) / 2

describe('frameIndex', () => {
  // 보는 사람은 (0, 0), 상대는 (5, 0). 상대가 나를 보는 각도는 π
  const frame = (facing: number) => frameIndex(0, 0, 5, 0, facing)

  test('나를 보면 0, 등지면 4', () => {
    expect(frame(Math.PI)).toBe(0)
    expect(frame(0)).toBe(4)
  })

  test('45°씩 돌 때마다 한 장씩 넘어감', () => {
    expect(frame(Math.PI + Math.PI / 4)).toBe(1)
    expect(frame(Math.PI + Math.PI / 2)).toBe(2)
    expect(frame(Math.PI - Math.PI / 4)).toBe(7)
  })

  test('22.5°를 넘어야 다음 장으로 넘어감', () => {
    expect(frame(Math.PI + 0.39)).toBe(0)
    expect(frame(Math.PI + 0.4)).toBe(1)
    expect(frame(Math.PI - 0.39)).toBe(0)
  })

  test('여러 바퀴 돈 각도도 0~7', () => {
    expect(frame(Math.PI + 6 * Math.PI)).toBe(0)
    expect(frame(Math.PI - 6 * Math.PI + Math.PI / 4)).toBe(1)
  })
})

describe('drawSprites', () => {
  test('정면에 있으면 화면 가운데에 그림', () => {
    const cols = columns(draw([at(4, 0)]))
    expect(cols.length).toBeGreaterThan(0)
    // 픽셀 중심으로 덮는지 가려서 반 픽셀까지 어긋날 수 있음
    expect(Math.abs(mid(cols) - W / 2)).toBeLessThanOrEqual(1)
  })

  test('오른쪽(+y)에 있으면 화면 오른쪽에 그림', () => {
    expect(mid(columns(draw([at(4, 2)])))).toBeGreaterThan(W / 2)
  })

  test('거리가 두 배면 폭이 절반', () => {
    const near = columns(draw([at(4, 0)])).length
    const far = columns(draw([at(8, 0)])).length
    expect(Math.abs(far - near / 2)).toBeLessThanOrEqual(1)
  })

  test('발이 벽 아래 끝과 같은 높이에 닿음', () => {
    // 거리 4인 벽의 아래 끝: h/2 + proj·0.5/4, proj = W/2
    expect(bottomRow(draw([at(4, 0)]))).toBeCloseTo(H / 2 + (W / 2) * 0.5 / 4, 0)
  })

  test('그림 높이는 h / PX_PER_CELL 칸', () => {
    const pixels = draw([at(4, 0)])
    let rows = 0
    for (let y = 0; y < H; y++) if (pixels[y * W + W / 2] !== 0) rows++
    // proj = W/2, 거리 4
    expect(rows).toBeCloseTo(((W / 2) * N) / PX_PER_CELL / 4, 0)
  })

  test('위를 보면 지평선을 따라 아래로 밀려 그려짐', () => {
    const level = bottomRow(draw([at(4, 0)]))
    const up = bottomRow(draw([at(4, 0)], undefined, makeCamera(0, 0, 0, 90, 0.2)))
    // 지평선이 proj·tan(0.2)만큼 내려감. proj = W/2
    expect(up - level).toBeCloseTo((W / 2) * Math.tan(0.2), 0)
  })

  test('카메라 뒤에 있으면 그리지 않음', () => {
    expect(columns(draw([at(-4, 0)]))).toEqual([])
  })

  test('벽이 더 가까운 가로줄에는 그리지 않음', () => {
    const zbuf = new Float64Array(W).fill(Infinity).fill(2, 0, W / 2)
    const cols = columns(draw([at(4, 0)], zbuf))
    expect(cols.length).toBeGreaterThan(0)
    expect(cols[0]).toBe(W / 2)
  })

  test('겹치면 가까운 것이 보임', () => {
    const pixels = draw([at(4, 0, solid(RED)), at(8, 0, solid(BLUE))])
    expect(pixels[(H / 2) * W + W / 2]).toBe(RED)
  })

  test('빛 색조를 곱해 칠함', () => {
    const pixels = draw([at(4, 0, solid(pack(200, 100, 50)))], undefined, undefined, [255, 128, 0])
    expect(pixels[(H / 2) * W + W / 2]).toBe(pack(200, 50, 0))
  })

  test('투명 픽셀(0)은 건너뜀', () => {
    const cols = columns(draw([at(4, 0, eight(2, 0, RED))]))
    expect(cols[0]).toBe(W / 2)
  })
})

describe('drawSprites 연기 (SHEEP-124)', () => {
  const puff = (x: number, alpha: number): Thing => ({ x, y: 0, z: 0.5, size: 0.5, alpha })

  test('연기 덩이는 바탕과 섞어 반투명하게 칠하고, 벽보다 멀면 칠하지 않음', () => {
    const pixels = new Uint32Array(W * H).fill(BLUE)
    drawSprites(pixels, W, H, new Float64Array(W).fill(Infinity), cam, [puff(2, 0.5)], WHITE)
    // 눈높이(0.5)라 화면 가운데
    const mid = pixels[(H / 2) * W + W / 2]
    expect(mid).not.toBe(BLUE)
    expect(mid & 255).toBeGreaterThan(80)
    expect((mid >>> 16) & 255).toBeGreaterThan(200)
    const hidden = new Uint32Array(W * H).fill(BLUE)
    drawSprites(hidden, W, H, new Float64Array(W).fill(1), cam, [puff(2, 0.5)], WHITE)
    expect(hidden.every((c) => c === BLUE)).toBe(true)
  })
})

