import { pack } from './render.ts'
import type { Sprite } from './sprite.ts'

const W = 32
const H = 64
const HEAD = 18
// 앞은 밝은 짚, 뒤는 어두운 헌 옷. 돌아선 쪽이 한눈에 보이게 크게 다르게 둠
const FRONT = [214, 182, 104] as const
const BACK = [104, 66, 40] as const

// 8방향 허수아비 임시 도형. 몸과 머리는 원기둥이고, 겉면이 바라보는 쪽을 향하면 앞 색으로 칠함.
// k번째 장은 나를 보던 허수아비가 시계 방향으로 k·45° 돈 모습 (frameIndex와 같은 순서)
// ponytail: 임시 그림. 기술 설계서 에셋대로 도형 모델을 렌더한 스프라이트 시트가 생기면 바꿈
export function makeScarecrowFrames(): Sprite[] {
  return Array.from({ length: 8 }, (_, k) => {
    const turned = (k * Math.PI) / 4
    const pixels = new Uint32Array(W * H)
    for (let y = 0; y < H; y++) {
      // 머리는 몸 폭의 절반
      const radius = y < HEAD ? 0.5 : 1
      for (let x = 0; x < W; x++) {
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
