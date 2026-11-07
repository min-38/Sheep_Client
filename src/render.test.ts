import { describe, expect, test } from 'vitest'
import { SKIES } from './desert.ts'
import type { Grid } from './raycast.ts'
import { horizonY, makeCamera, pack, renderFrame, tint } from './render.ts'

const W = 480
const H = 270
const FOV = 66

// 11×11 격자. wall(x, y)가 참인 칸이 벽
const grid = (wall: (x: number, y: number) => boolean): Grid =>
  Array.from({ length: 11 }, (_, y) => Array.from({ length: 11 }, (_, x) => (wall(x, y) ? 1 : 0)))
const border = (x: number, y: number) => x === 0 || y === 0 || x === 10 || y === 10
// 가운데 (5.5, 5.5)에서 +x로 4칸 앞에 둘레가 아닌 벽이 있는 방
const room = grid((x, y) => border(x, y) || x === 9)

function render(g: Grid, angle: number, pitch: number, sky = SKIES.noon) {
  const pixels = new Uint32Array(W * H)
  renderFrame(pixels, W, H, g, makeCamera(5.5, 5.5, angle, FOV, pitch), [], sky)
  return pixels
}

// 가운데 세로줄에서 벽이 칠해진 맨 위 줄과 맨 아래 줄
function wallSpan(pitch: number) {
  const cam = makeCamera(5.5, 5.5, 0, FOV, pitch)
  const pixels = render(room, 0, pitch)
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

  test('둘레 벽은 그리지 않아 둘레가 열린 맵과 같은 그림', () => {
    const open = grid(() => false)
    const walled = grid(border)
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 4) {
      expect(render(walled, angle, 0)).toEqual(render(open, angle, 0))
    }
  })

  test('위를 보면 하늘 그림(그라데이션, 해, 메사)이 지평선만큼 함께 내려감', () => {
    const proj = W / (2 * Math.tan((FOV * Math.PI) / 360))
    // 지평선이 딱 75줄 내려가는 시선
    const pitch = Math.atan(75 / proj)
    const open = grid(() => false)
    // 한 바퀴를 다 봐 모든 메사와 해를 거침
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 4) {
      const level = render(open, angle, 0, SKIES.sunset)
      const up = render(open, angle, pitch, SKIES.sunset)
      for (let y = 0; y < H / 2; y++) {
        expect(up.subarray((y + 75) * W, (y + 76) * W)).toEqual(level.subarray(y * W, (y + 1) * W))
      }
    }
  })
})

describe('tint', () => {
  test('채널마다 빛 색조/255를 곱함', () => {
    expect(tint(pack(200, 100, 50), [255, 128, 0])).toBe(pack(200, 50, 0))
  })

  test('흰 빛이면 그대로', () => {
    expect(tint(pack(17, 200, 255), [255, 255, 255])).toBe(pack(17, 200, 255))
  })
})
