import { describe, expect, test } from 'vitest'
import type { Grid } from './raycast.ts'
import { horizonY, makeCamera, renderFrame } from './render.ts'

const W = 480
const H = 270
const FOV = 66

// 가운데 (5.5, 5.5)에서 +x로 4칸 앞에 벽이 있는 방
const room: Grid = Array.from({ length: 11 }, (_, y) =>
  Array.from({ length: 11 }, (_, x) => (x === 0 || y === 0 || x === 10 || y === 10 || x === 9 ? 1 : 0)),
)

// 가운데 세로줄에서 벽이 칠해진 맨 위 줄과 맨 아래 줄
function wallSpan(pitch: number) {
  const cam = makeCamera(5.5, 5.5, 0, FOV, pitch)
  const pixels = new Uint32Array(W * H)
  renderFrame(pixels, W, H, room, cam, [])
  const proj = W / (2 * Math.hypot(cam.planeX, cam.planeY))
  const x = W / 2
  // 지평선 줄은 늘 벽 안이라 그 색을 벽 색으로 씀
  const wall = pixels[Math.round(horizonY(H, proj, pitch)) * W + x]
  let top = -1
  let bottom = -1
  for (let y = 0; y < H; y++) {
    if (pixels[y * W + x] !== wall) continue
    if (top < 0) top = y
    bottom = y
  }
  return { top, bottom, proj }
}

describe('horizonY', () => {
  test('정면을 보면 화면 가운데', () => {
    expect(horizonY(270, 200, 0)).toBe(135)
  })

  test('위를 보면 지평선이 아래로 내려감', () => {
    expect(horizonY(270, 200, 0.1)).toBeGreaterThan(135)
  })
})

describe('renderFrame', () => {
  test('위를 보면 벽의 위아래 끝이 지평선만큼 함께 내려감', () => {
    const level = wallSpan(0)
    const up = wallSpan(0.2)
    const shift = horizonY(H, level.proj, 0.2) - horizonY(H, level.proj, 0)
    expect(Math.abs(up.top - level.top - shift)).toBeLessThanOrEqual(1)
    expect(Math.abs(up.bottom - level.bottom - shift)).toBeLessThanOrEqual(1)
  })
})
