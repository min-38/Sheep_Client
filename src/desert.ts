import { blend, pack, type RGB } from './render.ts'
import type { Sprite, Thing } from './sprite.ts'

// 하늘 시간대 (시스템 기획서 결투장 시간대)
export type TimeOfDay = 'noon' | 'afternoon' | 'sunset'

// 그 라운드에 선 사람 수로 고름. 5명 이상은 한낮, 3~4명은 늦은 오후, 2명은 석양.
// 사람이 줄수록 해가 지는 흐름을 이어 판 사이에 혼자 있는 방(1명 이하)도 석양임
export const timeOfDay = (standing: number): TimeOfDay => (standing >= 5 ? 'noon' : standing >= 3 ? 'afternoon' : 'sunset')

// 하늘에 붙은 아주 먼 네모 하나. 가로는 방위, 세로는 높이각으로 정해져 돌면 같이 돌고 위아래를 보면 지평선을 따라감.
// az는 가운데 방위(라디안, makeCamera의 angle과 같은 축), half는 반폭(라디안), bottom·top은 아래·위 끝 높이각의 tan
export type Block = { az: number; half: number; bottom: number; top: number }
// 한 색으로 칠하는 덩어리들. 앞 층부터 칠해 뒤 층이 덮음
export type Layer = { blocks: readonly Block[]; color: number }
// 시간대 하나의 그림. 하늘 그라데이션과 해는 그 색 그대로이고, 모래·메사·구름·소품·플레이어에는 light를 곱함
export type Sky = { top: RGB; horizon: RGB; sandFar: RGB; sandNear: RGB; light: RGB; layers: readonly Layer[] }

const DEG = Math.PI / 180
// 도로 적은 덩어리 [가운데 방위, 반폭, 아래 높이각, 위 높이각]
const block = ([az, half, bottom, top]: readonly number[]): Block => ({
  az: az * DEG,
  half: half * DEG,
  bottom: Math.tan(bottom * DEG),
  top: Math.tan(top * DEG),
})

// 해는 늘 같은 방위(도)에 있고 시간대마다 높이만 바뀜. 석양에는 아래 반이 먼 메사에 걸림
const SUN_AZ = 200
const SUN_HALF = 2
// 높이와 상관없이 화면에서 정사각형으로 보이게 위아래도 방위와 같은 폭을 둠
function sunAt(height: number): Block {
  const r = SUN_HALF * DEG
  const center = Math.tan(height * DEG)
  return { az: SUN_AZ * DEG, half: r, bottom: center - r, top: center + r }
}

// 먼 메사. 낮고 넓으며 지평선 하늘빛이 섞여 흐림
const FAR_MESAS = [
  [0, 22, 0, 1.8],
  [62, 16, 0, 2.1],
  [128, 24, 0, 1.5],
  [196, 18, 0, 1.9],
  [282, 22, 0, 2.2],
].map(block)
// 가까운 메사. 넓은 단 위에 좁은 단을 얹어 계단진 블록 모양
const NEAR_MESAS = [
  [25, 10, 0, 3.2],
  [22, 5, 0, 4.6],
  [92, 13, 0, 2.6],
  [97, 6, 0, 3.8],
  [158, 7, 0, 4.2],
  [242, 12, 0, 3],
  [238, 5, 0, 4.4],
  [318, 9, 0, 3.4],
].map(block)
// 한낮에만 뜨는 네모 구름. 큰 판 위에 작은 판을 얹음. 정면을 볼 때 화면 맨 위가 약 20°라 그 아래에 둠
const CLOUDS = [
  [15, 6, 13, 15],
  [18, 3, 15, 16.5],
  [105, 8, 10, 12],
  [178, 5, 16, 18],
  [262, 7, 12, 14],
  [258, 3, 14, 15.5],
  [330, 4, 9, 10.5],
].map(block)

// 가까운 메사를 해 쪽 반(lit)과 그 반대쪽 반으로 나눔. 면마다 단색으로 칠해 블록처럼 보이게 함 (컨셉 기획서 화풍)
const halves = (lit: boolean) =>
  NEAR_MESAS.map((b) => {
    const side = (Math.sin(SUN_AZ * DEG - b.az) > 0) === lit ? 1 : -1
    return { ...b, az: b.az + (side * b.half) / 2, half: b.half / 2 }
  })
const NEAR_LIT = halves(true)
const NEAR_SHADE = halves(false)

// 빛 색조를 곱하기 전의 색
const SAND_NEAR: RGB = [232, 198, 142]
// 지평선 쪽 모래는 조금 어둡게 (시스템 기획서 결투장 바닥)
const SAND_FAR: RGB = [200, 164, 114]
const MESA: RGB = [192, 102, 64]
const MESA_SHADE: RGB = [134, 68, 46]
const CLOUD: RGB = [255, 255, 255]
// 먼 메사에 섞는 지평선 하늘빛의 비율
const HAZE = 0.45

const lit = (c: RGB, light: RGB): RGB => [
  Math.round((c[0] * light[0]) / 255),
  Math.round((c[1] * light[1]) / 255),
  Math.round((c[2] * light[2]) / 255),
]

type Time = { top: RGB; horizon: RGB; sun: RGB; sunHeight: number; light: RGB; clouds: boolean }

// 시간대마다 한 번만 만들어 두고 프레임마다 다시 계산하지 않음
function makeSky({ top, horizon, sun, sunHeight, light, clouds }: Time): Sky {
  const mesa = lit(MESA, light)
  return {
    top,
    horizon,
    light,
    sandFar: lit(SAND_FAR, light),
    sandNear: lit(SAND_NEAR, light),
    layers: [
      { blocks: [sunAt(sunHeight)], color: pack(...sun) },
      { blocks: clouds ? CLOUDS : [], color: pack(...lit(CLOUD, light)) },
      { blocks: FAR_MESAS, color: blend(mesa, horizon, HAZE) },
      { blocks: NEAR_LIT, color: pack(...mesa) },
      { blocks: NEAR_SHADE, color: pack(...lit(MESA_SHADE, light)) },
    ],
  }
}

// 시간대별 하늘 (시스템 기획서 결투장 시간대). sunHeight는 해 가운데 높이각(도).
// 정면을 볼 때 화면 맨 위가 약 20°, 다 올려 보면 약 48°라 한낮 해는 올려 봐야 보임
export const SKIES: Record<TimeOfDay, Sky> = {
  noon: makeSky({ top: [62, 128, 212], horizon: [168, 208, 238], sun: [255, 250, 222], sunHeight: 40, light: [255, 255, 255], clouds: true }),
  afternoon: makeSky({ top: [84, 118, 184], horizon: [236, 198, 140], sun: [255, 220, 140], sunHeight: 15, light: [255, 224, 182], clouds: false }),
  sunset: makeSky({ top: [58, 50, 112], horizon: [244, 130, 72], sun: [255, 176, 96], sunHeight: 2, light: [232, 150, 118], clouds: false }),
}

// 소품 그림 크기(px). sprite.ts HEIGHT(0.9칸) 높이로 그려져 1px이 0.0375칸임. 낮은 소품은 위를 비워 둠.
// ponytail: 모든 Thing이 키 하나를 같이 써 선인장도 사람 키를 넘지 못함. 더 크게 하려면 Thing에 키를 둠
const S = 24
type Rect = readonly [x: number, y: number, w: number, h: number, color: RGB]

// 네모를 차례로 쌓아 칠한 한 장. 앞면, 오른쪽 옆면(어둡게), 윗면(밝게)을 각각 단색으로 칠함 (컨셉 기획서 화풍).
// 둘레 소품이라 어느 쪽에서 봐도 같은 그림을 8방향에 씀
function blocks(rects: readonly Rect[]): Sprite[] {
  const pixels = new Uint32Array(S * S)
  for (const [x, y, w, h, c] of rects) for (let r = y; r < y + h; r++) pixels.fill(pack(...c), r * S + x, r * S + x + w)
  return Array(8).fill({ w: S, h: S, pixels })
}

const CACTUS: RGB = [92, 148, 70]
const CACTUS_SIDE: RGB = [60, 104, 50]
const CACTUS_TOP: RGB = [128, 180, 92]
// 선인장: 몸통과 높이가 다른 양팔
const CACTUS_RECTS: Rect[] = [
  [9, 1, 5, 23, CACTUS],
  [14, 1, 2, 23, CACTUS_SIDE],
  [9, 0, 7, 1, CACTUS_TOP],
  [4, 13, 5, 3, CACTUS],
  [4, 7, 3, 6, CACTUS],
  [7, 7, 1, 6, CACTUS_SIDE],
  [4, 6, 4, 1, CACTUS_TOP],
  [16, 10, 2, 3, CACTUS],
  [17, 4, 3, 9, CACTUS],
  [20, 4, 1, 9, CACTUS_SIDE],
  [17, 3, 4, 1, CACTUS_TOP],
]

const ROCK: RGB = [158, 130, 104]
const ROCK_SIDE: RGB = [112, 90, 74]
const ROCK_TOP: RGB = [196, 170, 140]
// 블록 바위: 넓은 덩이 위에 작은 덩이
const ROCK_RECTS: Rect[] = [
  [4, 14, 18, 2, ROCK_TOP],
  [2, 16, 16, 8, ROCK],
  [18, 16, 4, 8, ROCK_SIDE],
  [8, 10, 9, 2, ROCK_TOP],
  [6, 12, 9, 4, ROCK],
  [15, 12, 3, 4, ROCK_SIDE],
]

const WEED: RGB = [180, 144, 92]
const WEED_DARK: RGB = [120, 92, 58]
// 회전초: 성긴 덤불 덩이. 어두운 칸이 빈 틈
const WEED_RECTS: Rect[] = [
  [8, 16, 9, 8, WEED],
  [7, 18, 11, 4, WEED],
  [9, 15, 3, 1, WEED],
  [13, 15, 3, 1, WEED],
  [9, 18, 2, 2, WEED_DARK],
  [13, 17, 2, 2, WEED_DARK],
  [11, 20, 2, 2, WEED_DARK],
  [15, 20, 2, 2, WEED_DARK],
]

const PROPS = 18

// 결투장 중심(cx, cy) 둘레의 선인장, 바위, 회전초. 그림만이고 서버 판정에는 없음.
// 걷는 범위(중심에서 4칸)에 걸치면 결투장 안에 숨을 곳이 생기므로 5.5칸부터 둠. 둘레 벽 밖에도 두어 멀리까지 이어져 보이게 함
export function makeProps(cx: number, cy: number): Thing[] {
  const kinds = [blocks(CACTUS_RECTS), blocks(ROCK_RECTS), blocks(WEED_RECTS)]
  return Array.from({ length: PROPS }, (_, i) => {
    // 황금각(약 2.4라디안)씩 돌며 거리를 섞어 겹치지 않게 흩음. 고정된 식이라 늘 같은 자리
    const a = i * 2.4
    const r = 5.5 + ((i * 3.7) % 9)
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), facing: 0, frames: kinds[i % 3] }
  })
}
