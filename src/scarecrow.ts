import { pack } from './render.ts'
import type { Sprite } from './sprite.ts'

const W = 32
const H = 64
const HEAD = 18
// 앞은 밝은 짚, 뒤는 어두운 헌 옷. 돌아선 쪽이 한눈에 보이게 크게 다르게 둠
const FRONT = [214, 182, 104] as const
const BACK = [104, 66, 40] as const
const FLASH = pack(255, 232, 128)
// 불꽃 중심 높이(가슴)와 반지름(px)
const CHEST = 30
const FLASH_R = 5

// 8방향 허수아비 임시 도형. 몸과 머리는 원기둥이고, 겉면이 바라보는 쪽을 향하면 앞 색으로 칠함.
// k번째 장은 나를 보던 허수아비가 시계 방향으로 k·45° 돈 모습 (frameIndex와 같은 순서)
// flash면 쏘는 순간의 그림. 바라보는 쪽 가슴 앞에 불꽃을 띄움
// ponytail: 임시 그림. 기술 설계서 에셋대로 도형 모델을 렌더한 스프라이트 시트가 생기면 바꿈
export function makeScarecrowFrames(flash = false): Sprite[] {
  return Array.from({ length: 8 }, (_, k) => {
    const turned = (k * Math.PI) / 4
    const pixels = new Uint32Array(W * H)
    // 바라보는 쪽 겉면의 가로 자리(아래 u와 같은 단위). 등을 보이면 몸에 가려 그리지 않음
    const muzzle = flash && Math.cos(turned) > -0.5 ? -0.8 * Math.sin(turned) : null
    for (let y = 0; y < H; y++) {
      // 머리는 몸 폭의 절반
      const radius = y < HEAD ? 0.5 : 1
      for (let x = 0; x < W; x++) {
        if (muzzle !== null && Math.hypot(x + 0.5 - ((muzzle + 1) * W) / 2, y + 0.5 - CHEST) < FLASH_R) {
          pixels[y * W + x] = FLASH
          continue
        }
        // 원기둥 가로 위치 -1(왼쪽 끝) ~ 1(오른쪽 끝)
        const u = (((x + 0.5) / W) * 2 - 1) / radius
        if (Math.abs(u) > 1) continue
        // 이 겉면은 나를 향한 쪽에서 (내가 볼 때) 오른쪽으로 asin(u)만큼 기움. 바라보는 쪽과 90° 안이면 앞면
        const [r, g, b] = Math.cos(Math.asin(u) + turned) > 0 ? FRONT : BACK
        // 가장자리를 어둡게 해서 둥글게 보이게 함
        const shade = 0.55 + 0.45 * Math.sqrt(1 - u * u)
        pixels[y * W + x] = pack(Math.round(r * shade), Math.round(g * shade), Math.round(b * shade))
      }
    }
    return { w: W, h: H, pixels }
  })
}

// 쓰러진 허수아비 임시 도형. 바닥에 가로로 누운 몸과 왼쪽 끝 머리. 어느 쪽에서 봐도 같은 그림.
// 서 있는 그림과 같은 키로 늘여 그리므로 정사각형 바탕의 아래쪽에만 칠해 눕힘
// ponytail: 임시 그림. 스프라이트 시트가 생기면 8방향 쓰러짐 그림으로 바꿈
export function makeFallenFrames(): Sprite[] {
  const w = 64
  const h = 64
  const pixels = new Uint32Array(w * h)
  const paint = (x: number, y: number, [r, g, b]: readonly number[], shade: number) =>
    (pixels[y * w + x] = pack(Math.round(r * shade), Math.round(g * shade), Math.round(b * shade)))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 몸: 가로 원기둥, 가운데 높이 57, 반지름 6
      const v = (y + 0.5 - 57) / 6
      if (x >= 16 && x < 62 && Math.abs(v) < 1) paint(x, y, BACK, 0.55 + 0.45 * Math.sqrt(1 - v * v))
      // 머리: 반지름 5인 원
      const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 58) / 5
      if (d < 1) paint(x, y, FRONT, 0.55 + 0.45 * Math.sqrt(1 - d * d))
    }
  }
  const sprite = { w, h, pixels }
  return Array.from({ length: 8 }, () => sprite)
}
