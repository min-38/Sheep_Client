import { castRay, type Grid } from './raycast.ts'
import { drawSprites, type Thing } from './sprite.ts'

export type Camera = {
  x: number
  y: number
  dirX: number
  dirY: number
  // 화면 오른쪽 끝 광선 = dir + plane. 길이가 tan(fov/2)
  planeX: number
  planeY: number
  // 위아래 시선(라디안, 위가 +). 화면을 위아래로 밀어 보여 줌 (기술 설계서 렌더링 위아래 시점)
  pitch: number
}

type RGB = readonly [number, number, number]

const SKY_TOP: RGB = [88, 136, 196]
const SKY_HORIZON: RGB = [176, 204, 230]
const GRASS_HORIZON: RGB = [92, 128, 64]
const GRASS_NEAR: RGB = [52, 92, 36]

// ImageData를 Uint32Array로 쓸 때의 픽셀 값. 리틀 엔디언이라 ABGR 순서
export const pack = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0

const mix = (p: number, q: number, t: number) => Math.round(p + (q - p) * t)
const blend = (a: RGB, b: RGB, t: number) => pack(mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t))

const WALL_X = pack(132, 128, 118)
// y 면을 어둡게 해서 벽 모서리가 구분되게 함
const WALL_Y = pack(98, 95, 88)

// angle은 라디안(0 = +x, 격자 y는 아래로 증가), fov는 가로 시야각(도), pitch는 위아래 시선(라디안, 위가 +)
export function makeCamera(x: number, y: number, angle: number, fov: number, pitch = 0): Camera {
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const plane = Math.tan((fov * Math.PI) / 360)
  return { x, y, dirX, dirY, planeX: -dirY * plane, planeY: dirX * plane, pitch }
}

// 눈높이 수평선이 그려질 화면 줄. 위를 보면 내려가 화면 가운데가 그 각도의 시선이 됨 (y-shearing).
// 서버가 광선 높이를 tan(pitch)로 재므로 같은 식을 써야 조준점과 판정이 맞음
export function horizonY(h: number, proj: number, pitch: number): number {
  return h / 2 + proj * Math.tan(pitch)
}

export function renderFrame(pixels: Uint32Array, w: number, h: number, grid: Grid, cam: Camera, things: readonly Thing[]) {
  // 투영면까지의 거리(px). 화면 높이 대신 이 값으로 나눠야 16:9에서도 칸이 정사각형으로 보임
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  const horizon = horizonY(h, proj, cam.pitch)
  // 하늘과 땅의 경계. 화면 밖으로 나가도 0..h 안에서 칠함
  const half = Math.max(0, Math.min(h, Math.round(horizon)))
  for (let y = 0; y < h; y++) {
    const color = y < half
      ? blend(SKY_TOP, SKY_HORIZON, y / half)
      : blend(GRASS_HORIZON, GRASS_NEAR, (y - half) / (h - half))
    pixels.fill(color, y * w, (y + 1) * w)
  }

  // 가로줄마다 벽까지의 거리. 스프라이트가 벽 뒤에 있으면 가리는 데 씀
  const zbuf = new Float64Array(w).fill(Infinity)
  for (let x = 0; x < w; x++) {
    const camX = (2 * x) / w - 1
    const hit = castRay(grid, cam.x, cam.y, cam.dirX + cam.planeX * camX, cam.dirY + cam.planeY * camX)
    if (!hit) continue
    zbuf[x] = hit.dist
    // 눈높이는 벽의 절반이라 지평선에서 위아래로 반씩
    const halfH = (proj * 0.5) / hit.dist
    const top = Math.max(0, Math.floor(horizon - halfH))
    const bottom = Math.min(h, Math.ceil(horizon + halfH))
    const color = hit.side === 0 ? WALL_X : WALL_Y
    for (let y = top; y < bottom; y++) pixels[y * w + x] = color
  }

  drawSprites(pixels, w, h, zbuf, cam, things)
}
