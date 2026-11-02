import type { Camera } from './render.ts'

// 스프라이트 한 장. 픽셀 형식은 render.ts의 pack과 같고, 0은 투명
export type Sprite = { w: number; h: number; pixels: Uint32Array }

// 결투장에 선 것 하나. facing은 바라보는 각도(라디안), frames는 8방향 그림
export type Thing = { x: number; y: number; facing: number; frames: readonly Sprite[] }

const STEP = Math.PI / 4
// 벽 높이를 1로 볼 때 키. ponytail: 임시 값. 스프라이트 시트를 만들 때 그림 비율에 맞춰 다시 잡음
const HEIGHT = 0.9
// 이보다 가까우면 그리지 않음. 0에 가까우면 크기가 무한대로 커짐
const NEAR = 0.05

// 8장 중 고를 장. 0은 나를 봄, 4는 등을 짐. 상대가 격자 기준 시계 방향으로 45° 돌 때마다 1씩 늘어남
export function frameIndex(viewX: number, viewY: number, x: number, y: number, facing: number): number {
  const toViewer = Math.atan2(viewY - y, viewX - x)
  const k = Math.round((facing - toViewer) / STEP)
  return ((k % 8) + 8) % 8
}

// 벽을 그린 뒤에 부름. zbuf는 가로줄마다 벽까지의 수직 거리
export function drawSprites(pixels: Uint32Array, w: number, h: number, zbuf: Float64Array, cam: Camera, things: readonly Thing[]) {
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
    const tex = t.frames[frameIndex(cam.x, cam.y, t.x, t.y, t.facing)]
    const height = (proj * HEIGHT) / depth
    const width = (height * tex.w) / tex.h
    // 발은 벽 아래 끝과 같은 높이 (눈높이는 벽의 절반)
    const bottom = h / 2 + (proj * 0.5) / depth
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
        if (c !== 0) pixels[y * w + x] = c
      }
    }
  }
}
