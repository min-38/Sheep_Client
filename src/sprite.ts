import { drawFigure, type Figure } from './character.ts'
import { HEAD } from './hitcard.ts'
import { horizonY, pack, tint, type Camera, type RGB } from './render.ts'

// 스프라이트 한 장. 픽셀 형식은 render.ts의 pack과 같고, 0은 투명
export type Sprite = { w: number; h: number; pixels: Uint32Array }

// 결투장에 선 소품 하나. facing은 바라보는 각도(라디안), frames는 8방향 그림
export type Prop = { x: number; y: number; facing: number; frames: readonly Sprite[] }
// 공중에 뜬 작은 네모 하나. 연기 덩이(SHEEP-124)와 날아가는 총알·잔상(SHEEP-125)을 그림. z는 가운데 높이, size는 한 변(칸),
// alpha는 불투명도(0~1), rgb는 색이고 없으면 연기 색. 늘 카메라를 보는 네모로 바탕과 섞어 칠함
export type Speck = { x: number; y: number; z: number; size: number; alpha: number; rgb?: RGB }
// 결투장에 선 것 하나. 사람은 상자(boxes)로 매 프레임 3D로 그림
export type Thing = Prop | Figure | Speck
// 연기 색. 빛 색조를 곱해 석양에는 붉게 물듦
const SMOKE: RGB = [225, 225, 220]

const STEP = Math.PI / 4
// 그림 px와 칸(벽 높이 1)의 비율. 모든 소품 그림을 같은 배율로 그림. 사람 키(판정 머리 위)가 64px인 배율
export const PX_PER_CELL = 64 / HEAD.top
// 이보다 가까우면 그리지 않음. 0에 가까우면 크기가 무한대로 커짐
const NEAR = 0.05

// 8장 중 고를 장. 0은 나를 봄, 4는 등을 짐. 상대가 격자 기준 시계 방향으로 45° 돌 때마다 1씩 늘어남
export function frameIndex(viewX: number, viewY: number, x: number, y: number, facing: number): number {
  const toViewer = Math.atan2(viewY - y, viewX - x)
  const k = Math.round((facing - toViewer) / STEP)
  return ((k % 8) + 8) % 8
}

// 벽을 그린 뒤에 부름. zbuf는 가로줄마다 벽까지의 수직 거리, light는 모든 픽셀에 곱하는 그 시간대의 빛 색조
export function drawSprites(pixels: Uint32Array, w: number, h: number, zbuf: Float64Array, cam: Camera, things: readonly Thing[], light: RGB) {
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  // 카메라 행렬 [plane dir]의 역행렬로 카메라 기준 좌표를 구함. side는 plane 길이 단위, depth는 수직 거리
  const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY)
  const seen = things
    .map((t) => {
      const rx = t.x - cam.x
      const ry = t.y - cam.y
      return { t, side: invDet * (cam.dirY * rx - cam.dirX * ry), depth: invDet * (cam.planeX * ry - cam.planeY * rx) }
    })
    .filter((s) => s.depth > NEAR)
    // 먼 것부터 그려 가까운 것이 덮게 함
    .sort((a, b) => b.depth - a.depth)

  for (const { t, side, depth } of seen) {
    if ('boxes' in t) {
      drawFigure(pixels, w, h, zbuf, cam, t, light)
      continue
    }
    if ('alpha' in t) {
      const half = (proj * t.size) / 2 / depth
      const cx = (w / 2) * (1 + side / depth)
      const cy = horizonY(h, proj, cam.pitch) + (proj * ((cam.z ?? 0.5) - t.z)) / depth
      const color = (t.rgb ?? SMOKE).map((c, i) => (c * light[i]) / 255)
      const mix = (c: number, i: number) => Math.round(((c >>> (8 * i)) & 255) * (1 - t.alpha) + color[i] * t.alpha)
      for (let x = Math.max(0, Math.ceil(cx - half - 0.5)); x < Math.min(w, Math.ceil(cx + half - 0.5)); x++) {
        if (depth >= zbuf[x]) continue
        for (let y = Math.max(0, Math.ceil(cy - half - 0.5)); y < Math.min(h, Math.ceil(cy + half - 0.5)); y++) {
          const c = pixels[y * w + x]
          pixels[y * w + x] = pack(mix(c, 0), mix(c, 1), mix(c, 2))
        }
      }
      continue
    }
    const tex = t.frames[frameIndex(cam.x, cam.y, t.x, t.y, t.facing)]
    const height = (proj * tex.h) / PX_PER_CELL / depth
    const width = (proj * tex.w) / PX_PER_CELL / depth
    // 발은 바닥(높이 0)이라 지평선에서 눈높이만큼 아래. 위아래를 보면 지평선을 따라 밀림
    const bottom = horizonY(h, proj, cam.pitch) + (proj * (cam.z ?? 0.5)) / depth
    const top = bottom - height
    const left = (w / 2) * (1 + side / depth) - width / 2
    // 픽셀 중심이 그림 안에 드는 픽셀만 칠함
    const x0 = Math.max(0, Math.ceil(left - 0.5))
    const x1 = Math.min(w, Math.ceil(left + width - 0.5))
    const y0 = Math.max(0, Math.ceil(top - 0.5))
    const y1 = Math.min(h, Math.ceil(bottom - 0.5))
    for (let x = x0; x < x1; x++) {
      if (depth >= zbuf[x]) continue
      const u = Math.floor(((x + 0.5 - left) / width) * tex.w)
      for (let y = y0; y < y1; y++) {
        const c = tex.pixels[Math.floor(((y + 0.5 - top) / height) * tex.h) * tex.w + u]
        if (c !== 0) pixels[y * w + x] = tint(c, light)
      }
    }
  }
}
