import { pack } from './render.ts'
import type { Sprite } from './sprite.ts'

// 그림 크기(px). 든 총이 몸 밖으로 나와도 그리게 몸 폭의 두 배로 잡고 몸은 가운데에 둠.
// 그리는 크기는 그림 비율로 정해지므로 몸은 폭 32일 때와 같은 크기로 보임
const W = 64
const H = 64
const CENTER = W / 2
// 몸 반지름(px). 머리는 그 절반
const R = 16
const HEAD = 18
const STEP = Math.PI / 4
// 앞은 밝은 짚, 뒤는 어두운 헌 옷. 돌아선 쪽이 한눈에 보이게 크게 다르게 둠
const FRONT = [214, 182, 104] as const
const BACK = [104, 66, 40] as const
const ARM = pack(150, 104, 58)
const GUN = pack(38, 36, 34)
const FLASH = pack(255, 232, 128)
const FLASH_R = 7
// 어깨, 겨눈 손, 관자놀이 높이(px)와 팔·총열 길이(px)
const SHOULDER = 24
const AIM_Y = 27
const TEMPLE_Y = 9
const ARM_LEN = 24
const BARREL = 6

// ms. 시간 초과로 쓰러진 사람이 총을 머리에 대고 있는 시간과 그 뒤 불꽃 시간. 그다음엔 쓰러진 그림.
// ponytail: 임시 값(시스템 기획서 판 흐름 시간). 플레이해 보며 정함
export const SUICIDE_AIM = 600
export const SUICIDE_FLASH = 100

// 시간 초과로 쓰러진 뒤 지난 시간(ms)으로 고른 자살 단계. 0은 총을 댐, 1은 불꽃, null은 다 끝나 쓰러진 그림
export const suicideStage = (elapsed: number): 0 | 1 | null => (elapsed < SUICIDE_AIM ? 0 : elapsed < SUICIDE_AIM + SUICIDE_FLASH ? 1 : null)

// 8방향 허수아비 임시 도형. 몸과 머리는 원기둥이고, 겉면이 바라보는 쪽을 향하면 앞 색으로 칠함.
// k번째 장은 나를 보던 허수아비가 시계 방향으로 k·45° 돈 모습 (frameIndex와 같은 순서)
// ponytail: 임시 그림. 기술 설계서 에셋대로 도형 모델을 렌더한 스프라이트 시트가 생기면 바꿈
export const makeScarecrowFrames = (): Sprite[] => Array.from({ length: 8 }, (_, k) => frame(k * STEP, null, true))

// "시작!" 뒤 리볼버를 바라보는 쪽으로 겨눈 모습 (컨셉 기획서 규칙 조준은 따로 누르지 않음).
// flash면 쏘는 순간의 그림. 총구 앞에 불꽃을 띄움
export function makeAimingFrames(flash = false): Sprite[] {
  return Array.from({ length: 8 }, (_, k) => {
    const turned = k * STEP
    // 바라보는 쪽이 화면에서 가로로 놓이는 방향. 나를 보면 0이라 총구가 가슴 가운데에 보임
    const fx = -Math.sin(turned)
    const hand = CENTER + fx * ARM_LEN
    const muzzle = hand + fx * BARREL
    const held = (p: Uint32Array) => {
      limb(p, CENTER, SHOULDER, hand, AIM_Y, 3, ARM)
      limb(p, hand, AIM_Y, muzzle, AIM_Y, 2, GUN)
      disc(p, hand, AIM_Y, 4, GUN)
      if (flash) disc(p, muzzle, AIM_Y, FLASH_R, FLASH)
    }
    return frame(turned, held, Math.cos(turned) >= 0)
  })
}

// 시간 초과 자살 모습 두 단계 [총을 오른쪽 관자놀이에 댐, 머리 옆 불꽃], 각 8방향 (컨셉 기획서 규칙 제한 시간)
export function makeSuicideFrames(): Sprite[][] {
  const stage = (flash: boolean) =>
    Array.from({ length: 8 }, (_, k) => {
      const turned = k * STEP
      // 오른손 쪽이 화면에서 가로로 놓이는 방향. 나를 보면 내 왼쪽
      const rx = -Math.cos(turned)
      const hand = CENTER + rx * (R / 2 + 3)
      const held = (p: Uint32Array) => {
        limb(p, CENTER + rx * (R - 4), SHOULDER, hand, TEMPLE_Y, 3, ARM)
        disc(p, hand, TEMPLE_Y, 4, GUN)
        if (flash) disc(p, CENTER + rx * (R / 2), TEMPLE_Y, FLASH_R, FLASH)
      }
      return frame(turned, held, Math.sin(turned) >= 0)
    })
  return [stage(false), stage(true)]
}

// 몸과 든 것을 칠한 한 장. 든 것이 몸 뒤면 먼저 칠해 몸이 덮게 함
function frame(turned: number, held: ((p: Uint32Array) => void) | null, front: boolean): Sprite {
  const pixels = new Uint32Array(W * H)
  if (held && !front) held(pixels)
  for (let y = 0; y < H; y++) {
    // 머리는 몸 폭의 절반
    const radius = y < HEAD ? 0.5 : 1
    for (let x = CENTER - R; x < CENTER + R; x++) {
      // 원기둥 가로 위치 -1(왼쪽 끝) ~ 1(오른쪽 끝)
      const u = ((x + 0.5 - CENTER) / R) / radius
      if (Math.abs(u) > 1) continue
      // 이 겉면은 나를 향한 쪽에서 (내가 볼 때) 오른쪽으로 asin(u)만큼 기움. 바라보는 쪽과 90° 안이면 앞면
      const [r, g, b] = Math.cos(Math.asin(u) + turned) > 0 ? FRONT : BACK
      // 가장자리를 어둡게 해서 둥글게 보이게 함
      const shade = 0.55 + 0.45 * Math.sqrt(1 - u * u)
      pixels[y * W + x] = pack(Math.round(r * shade), Math.round(g * shade), Math.round(b * shade))
    }
  }
  if (held && front) held(pixels)
  return { w: W, h: H, pixels }
}

function disc(pixels: Uint32Array, cx: number, cy: number, r: number, color: number) {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, Math.ceil(cx + r)); x++)
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) pixels[y * W + x] = color
}

// 굵기 r인 선. 원을 촘촘히 이어 칠함
function limb(pixels: Uint32Array, x0: number, y0: number, x1: number, y1: number, r: number, color: number) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1
  for (let i = 0; i <= n; i++) disc(pixels, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, color)
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
