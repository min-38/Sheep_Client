import { castRay, type Grid } from './raycast.ts'

export type Camera = {
  x: number
  y: number
  dirX: number
  dirY: number
  // 화면 오른쪽 끝 광선 = dir + plane. 길이가 tan(fov/2)
  planeX: number
  planeY: number
}

type RGB = readonly [number, number, number]

const SKY_TOP: RGB = [88, 136, 196]
const SKY_HORIZON: RGB = [176, 204, 230]
const GRASS_HORIZON: RGB = [92, 128, 64]
const GRASS_NEAR: RGB = [52, 92, 36]

// ImageData를 Uint32Array로 쓸 때의 픽셀 값. 리틀 엔디언이라 ABGR 순서
const pack = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0

const mix = (p: number, q: number, t: number) => Math.round(p + (q - p) * t)
const blend = (a: RGB, b: RGB, t: number) => pack(mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t))

const WALL_X = pack(132, 128, 118)
// y 면을 어둡게 해서 벽 모서리가 구분되게 함
const WALL_Y = pack(98, 95, 88)

// angle은 라디안(0 = +x, 격자 y는 아래로 증가), fov는 가로 시야각(도)
export function makeCamera(x: number, y: number, angle: number, fov: number): Camera {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const plane = Math.tan((fov * Math.PI) / 360)
  return { x, y, dirX, dirY, planeX: -dirY * plane, planeY: dirX * plane }
}

export function renderFrame(pixels: Uint32Array, w: number, h: number, grid: Grid, cam: Camera) {
  const half = h >> 1
  for (let y = 0; y < h; y++) {
    const color = y < half
      ? blend(SKY_TOP, SKY_HORIZON, y / half)
      : blend(GRASS_HORIZON, GRASS_NEAR, (y - half) / (h - half))
    pixels.fill(color, y * w, (y + 1) * w)
  }

  // 투영면까지의 거리(px). 화면 높이 대신 이 값으로 나눠야 16:9에서도 칸이 정사각형으로 보임
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  for (let x = 0; x < w; x++) {
    const camX = (2 * x) / w - 1
    const hit = castRay(grid, cam.x, cam.y, cam.dirX + cam.planeX * camX, cam.dirY + cam.planeY * camX)
    if (!hit) continue
    const lineH = proj / hit.dist
    const top = Math.max(0, Math.floor((h - lineH) / 2))
    const bottom = Math.min(h, Math.ceil((h + lineH) / 2))
    const color = hit.side === 0 ? WALL_X : WALL_Y
    for (let y = top; y < bottom; y++) pixels[y * w + x] = color
  }
}
