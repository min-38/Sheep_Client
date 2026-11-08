import { HEAD } from './hitcard.ts'
import { horizonY, pack, tint, type Camera } from './render.ts'
import { STEP_MS } from './round.ts'

// 블록 캐릭터 (컨셉 기획서 아트). 상자를 쌓아 사람을 만들고, 매 프레임 그 자리와 각도에서 3D로 그림.
// 모델 좌표는 블록 단위이고 x는 그 사람의 오른쪽, y는 위, z는 앞. 원점은 두 발 사이 바닥

type V = readonly [number, number, number]
type RGB = readonly [number, number, number]
// 상자 하나. c는 가운데, axes는 세 변의 방향(단위 벡터), half는 그 방향의 반 길이
export type Box = { c: V; axes: readonly [V, V, V]; half: V; rgb: RGB }

// 동작별 상자. walk는 흔드는 각도(walkSwing)로 그때그때 만들고, suicide는 [총을 머리에 댐, 불꽃] 두 단계
export type Body = { stand: Box[]; walk: (swing: number) => Box[]; aim: Box[]; fire: Box[]; suicide: Box[][]; fallen: Box[] }

// 목수건 색. 들어온 순서(state의 color)대로 (시스템 기획서 사람 색)
export const SCARVES = [0xd83a3a, 0x4fb3e8, 0x34a853, 0xf2cf2a, 0xf08a1c, 0xee77b8, 0xf4f4f4, 0x2a2a2a]

// ms. 시간 초과로 쓰러진 사람이 총을 머리에 대고 있는 시간과 그 뒤 불꽃 시간. 그다음엔 쓰러진 그림.
// ponytail: 임시 값(시스템 기획서 판 흐름 시간). 플레이해 보며 정함
export const SUICIDE_AIM = 600
export const SUICIDE_FLASH = 100

// 시간 초과로 쓰러진 뒤 지난 시간(ms)으로 고른 자살 단계. 0은 총을 댐, 1은 불꽃, null은 다 끝나 쓰러진 그림
export const suicideStage = (elapsed: number): 0 | 1 | null => (elapsed < SUICIDE_AIM ? 0 : elapsed < SUICIDE_AIM + SUICIDE_FLASH ? 1 : null)

const rgb = (hex: number): RGB => [hex >> 16, (hex >> 8) & 255, hex & 255]

// 셔츠만 시스템 기획서 차림에서 정한 색. ponytail: 나머지는 임시 색. 플레이해 보며 정함
const SHIRT = rgb(0x283c8c)
const SKIN = rgb(0xe0ac7e)
const EYE = rgb(0x1a1a1a)
const HAT = rgb(0xa47a4c)
const VEST = rgb(0x6e4024)
const JEANS = rgb(0x5a78a8)
const BOOTS = rgb(0x3a2416)
const HOLSTER = rgb(0x4a2a14)
const GUN = rgb(0x3a3a40)
const FLASH = rgb(0xffe880)

// 비율 A의 키(블록, 머리 위까지). 다리 12, 몸통 12, 머리 8
const TALL = 32
// 블록 한 칸의 길이(칸). 키가 판정 머리 위(HEAD.top)와 같음
export const CELL = HEAD.top / TALL
// 이보다 가까운 면은 그리지 않음 (sprite.ts의 NEAR와 같음)
const NEAR = 0.05
// 모자 꼭대기(블록). 쓰러지면 발에서 여기까지가 누운 길이
const HAT_TOP = 36.5
// 오른쪽 어깨 관절. 팔은 여기를 축으로 돎
const SHOULDER: V = [6, 22, 0]
// 라디안. 걸을 때 팔다리를 앞뒤로 흔드는 각도. ponytail: 임시 값. 플레이해 보며 정함
const SWING = 0.45
// 라디안. 쏠 때 반동으로 팔이 들리는 각도. ponytail: 임시 값. 플레이해 보며 정함
const RECOIL = 0.5

const X: V = [1, 0, 0]
const Y: V = [0, 1, 0]
const Z: V = [0, 0, 1]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const unit = (a: V): V => add([0, 0, 0], a, 1 / Math.hypot(...a))
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
// a에서 d에 나란한 부분을 뺀 방향
const across = (a: V, d: V) => unit(add(a, d, -dot(a, d)))

// 축에 나란한 상자. 마주 보는 두 꼭짓점으로 정함
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: RGB): Box => ({
  c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  axes: [X, Y, Z],
  half: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2],
  rgb: color,
})

// 팔다리처럼 p에서 d쪽으로 뻗은 막대의 [from, to] 구간. 단면은 size×size
function rod(p: V, d: V, from: number, to: number, size: number, color: RGB): Box {
  const side = across(Math.abs(d[0]) < 0.9 ? X : Z, d)
  return { c: add(p, d, (from + to) / 2), axes: [side, d, cross(d, side)], half: [size / 2, (to - from) / 2, size / 2], rgb: color }
}

// 어깨나 엉덩이에서 아래로 뻗은 팔다리를 앞(+)뒤로 a만큼 흔든 방향
const down = (a: number): V => [0, -Math.cos(a), Math.sin(a)]

// 셔츠 소매 끝에 손
const arm = (p: V, d: V) => [rod(p, d, -2, 8, 4, SHIRT), rod(p, d, 8, 10, 4, SKIN)]

// 오른팔을 d쪽으로 뻗어 든 총. 총열은 주먹 위에 얹힘. flash면 총구 앞에 불꽃
function holding(d: V, flash: boolean): Box[] {
  const barrel = add(SHOULDER, across(Y, d), 1.5)
  const boxes = [...arm(SHOULDER, d), rod(barrel, d, 8.5, 14, 1.5, GUN)]
  return flash ? [...boxes, rod(barrel, d, 14, 19, 5, FLASH)] : boxes
}

// 오른손을 오른쪽 관자놀이로 올려 총구를 머리에 댐. 팔꿈치를 옆으로 굽힘
function temple(flash: boolean): Box[] {
  const elbow: V = [11, 24, 0]
  const upper = unit(add(elbow, SHOULDER, -1))
  const fore = unit([-1.5, 5, 0])
  const boxes = [
    rod(SHOULDER, upper, -2, Math.hypot(5, 2) + 2, 4, SHIRT),
    rod(elbow, fore, -2, 5, 4, SHIRT),
    rod(elbow, fore, 5, 7, 4, SKIN),
    box(4, 29, -0.75, 9, 30.5, 0.75, GUN),
  ]
  return flash ? [...boxes, box(3, 27.5, -2.5, 8, 32.5, 2.5, FLASH)] : boxes
}

// 사람 하나. 오른팔(right)은 동작마다 달라 따로 받음. swing은 걸을 때 흔드는 각도(+면 오른다리가 앞). holstered면 권총집에 총이 꽂혀 있음
function figure(scarf: RGB, swing: number, right: Box[], holstered: boolean): Box[] {
  const boxes = [
    // 머리와 눈, 모자. 모자는 판정에 넣지 않아 키 위로 나옴
    box(-4, 24, -4, 4, 32, 4, SKIN),
    box(-2.5, 27, 4, -1.5, 29, 4.01, EYE),
    box(1.5, 27, 4, 2.5, 29, 4.01, EYE),
    box(-6, 32, -6, 6, 33, 6, HAT),
    box(-3.5, 33, -3.5, 3.5, HAT_TOP, 3.5, HAT),
    // 몸통은 조끼이고, 앞이 열려 셔츠가 보임. 목수건은 목에 두르고 앞으로 늘어뜨림
    box(-4, 12, -2, 4, 24, 2, VEST),
    box(-1.25, 12, 2, 1.25, 21.5, 2.01, SHIRT),
    box(-4.01, 21.5, -2.01, 4.01, 24, 2.01, scarf),
    box(-2.5, 20, 2, 2.5, 21.5, 2.02, scarf),
    box(-1.25, 18.75, 2, 1.25, 20, 2.02, scarf),
    // 오른쪽 엉덩이의 권총집
    box(4, 5, -1.5, 5.5, 11, 1.5, HOLSTER),
    ...arm([-6, 22, 0], down(swing)),
    ...right,
  ]
  for (const [x, a] of [[2, swing], [-2, -swing]]) {
    const d = down(a)
    boxes.push(rod([x, 12, 0], d, 0, 9, 4, JEANS), rod([x, 12, 0], d, 9, 12, 4, BOOTS))
  }
  // 총 손잡이가 권총집 뒤로 나옴
  if (holstered) boxes.push(box(4.25, 10.5, -2.75, 5.25, 12, -1, GUN))
  return boxes
}

// 상자의 꼭짓점 8개
export const corners = (b: Box): V[] =>
  Array.from({ length: 8 }, (_, i) => b.axes.reduce((p, axis, j) => add(p, axis, (i >> j) & 1 ? b.half[j] : -b.half[j]), b.c))

// 오른쪽으로 쓰러져 누움. 오른쪽이 바닥, 머리가 +x. 누운 몸의 가운데가 서 있던 자리
const lay = (b: Box): Box => {
  const turn = (v: V): V => [v[1], -v[0], v[2]]
  const [x, y, z] = turn(b.c)
  return { ...b, c: [x - HAT_TOP / 2, y, z], axes: [turn(b.axes[0]), turn(b.axes[1]), turn(b.axes[2])] }
}

// 가장 낮은 곳이 바닥에 닿게 올림
function ground(boxes: Box[]): Box[] {
  const bottom = Math.min(...boxes.flatMap((b) => corners(b).map((p) => p[1])))
  return boxes.map((b) => ({ ...b, c: [b.c[0], b.c[1] - bottom, b.c[2]] }))
}

function build(scarf: RGB): Body {
  const stand = figure(scarf, 0, arm(SHOULDER, down(0)), true)
  const aimed = (d: V, flash: boolean) => figure(scarf, 0, holding(d, flash), false)
  return {
    stand,
    walk: (a) => figure(scarf, a, arm(SHOULDER, down(-a)), true),
    aim: aimed(Z, false),
    fire: aimed([0, Math.sin(RECOIL), Math.cos(RECOIL)], true),
    suicide: [false, true].map((flash) => figure(scarf, 0, temple(flash), false)),
    fallen: ground(stand.map(lay)),
  }
}

const cache: Body[] = []

// 목수건 색 번호(state의 color, 0~7)의 모든 동작. 색마다 처음 부를 때 한 번 만듦
export const characterBody = (color: number): Body => (cache[color] ??= build(rgb(SCARVES[color])))

// 걷기 시각부터 지난 시간(ms)의 팔다리 흔들림 각도. 걸음(발소리, round.ts stepIndex)마다 한쪽 다리가 가장 앞에 오고 그 사이는 이어서 흔듦
export const walkSwing = (elapsed: number) => SWING * Math.cos((Math.PI * elapsed) / STEP_MS)

// 결투장에 선 사람 하나. facing은 바라보는 각도(라디안, 0 = +x)
export type Figure = { x: number; y: number; facing: number; boxes: readonly Box[] }

// 사람을 그 자리와 각도에서 본 대로 그림. 픽셀마다 눈에서 쏜 광선이 처음 닿는 상자 면을 칠하고, 그 면이 벽(zbuf)보다 멀면 건너뜀.
// 광선의 t는 카메라에서 앞으로 간 수직 거리라 벽까지의 거리(zbuf)와 바로 견줌. light는 그 시간대의 빛 색조
export function drawFigure(pixels: Uint32Array, w: number, h: number, zbuf: Float64Array, cam: Camera, fig: Figure, light: RGB) {
  const proj = w / (2 * Math.hypot(cam.planeX, cam.planeY))
  const horizon = horizonY(h, proj, cam.pitch)
  const invDet = 1 / (cam.planeX * cam.dirY - cam.dirX * cam.planeY)
  const cos = Math.cos(fig.facing)
  const sin = Math.sin(fig.facing)
  // 격자 방향과 높이(칸)를 그 사람의 모델 좌표(블록)로 바꿈. 격자 y가 아래로 늘어 앞에서 시계 방향으로 90°가 오른쪽
  const toModel = (gx: number, gy: number, up: number): V => [(-sin * gx + cos * gy) / CELL, up / CELL, (cos * gx + sin * gy) / CELL]
  // 모델 좌표의 점이 화면에 놓이는 [x, y]. 카메라 앞 NEAR보다 가까우면 null
  const project = (p: V): [number, number] | null => {
    const rx = fig.x + (-sin * p[0] + cos * p[2]) * CELL - cam.x
    const ry = fig.y + (cos * p[0] + sin * p[2]) * CELL - cam.y
    const depth = invDet * (cam.planeX * ry - cam.planeY * rx)
    if (depth < NEAR) return null
    return [(w / 2) * (1 + (invDet * (cam.dirY * rx - cam.dirX * ry)) / depth), horizon + (proj * (0.5 - p[1] * CELL)) / depth]
  }
  // 눈은 벽 높이의 절반
  const eye = toModel(cam.x - fig.x, cam.y - fig.y, 0.5)
  // 빛은 내 쪽 왼쪽 위에서 옴. 어느 쪽에서 봐도 같은 쪽이 밝음
  const screenX = unit(toModel(cam.planeX, cam.planeY, 0))
  const lit = unit(add(add(Y, screenX, -1), unit([eye[0], 0, eye[2]]), 1.4))
  const local = fig.boxes.map((b) => {
    // 꼭짓점을 화면에 비춘 범위만 검사함. 일부가 카메라 뒤면 화면 전체, 모두 뒤면 비움
    const seen = corners(b).map(project)
    const on = seen.filter((s) => s !== null)
    const xs = on.map((s) => s[0])
    const ys = on.map((s) => s[1])
    const all = on.length < 8
    return {
      half: b.half,
      axes: b.axes,
      o: b.axes.map((a) => dot(add(eye, b.c, -1), a)),
      x0: on.length === 0 ? w : all ? 0 : Math.max(0, Math.floor(Math.min(...xs))),
      x1: on.length === 0 ? 0 : all ? w : Math.min(w, Math.ceil(Math.max(...xs))),
      y0: all ? 0 : Math.max(0, Math.floor(Math.min(...ys))),
      y1: all ? h : Math.min(h, Math.ceil(Math.max(...ys))),
      // 이 세로줄 광선 방향의 축별 가로 몫. 세로줄마다 다시 셈
      across: new Float64Array(3),
      // 축마다 광선이 들어가는 두 면(-쪽, +쪽)의 색. 불꽃은 스스로 빛나 면 밝기를 곱하지 않음
      face: b.axes.flatMap((a) =>
        [-1, 1].map((side) => {
          const k = b.rgb === FLASH ? 1 : 0.55 + 0.45 * Math.max(0, side * dot(a, lit))
          return tint(pack(Math.round(b.rgb[0] * k), Math.round(b.rgb[1] * k), Math.round(b.rgb[2] * k)), light)
        }),
      ),
    }
  })
  const x0 = Math.min(...local.map((b) => b.x0))
  const x1 = Math.max(...local.map((b) => b.x1))

  for (let px = x0; px < x1; px++) {
    const camX = (2 * (px + 0.5)) / w - 1
    const ray = toModel(cam.dirX + cam.planeX * camX, cam.dirY + cam.planeY * camX, 0)
    const column = local.filter((b) => px >= b.x0 && px < b.x1)
    if (column.length === 0) continue
    for (const b of column) for (let i = 0; i < 3; i++) b.across[i] = dot(ray, b.axes[i])
    const y0 = Math.min(...column.map((b) => b.y0))
    const y1 = Math.max(...column.map((b) => b.y1))
    for (let py = y0; py < y1; py++) {
      // 광선의 위아래 몫. 지평선보다 아래 줄이면 내려감
      const rise = -(py + 0.5 - horizon) / proj / CELL
      let nearest = zbuf[px]
      for (const b of column) {
        if (py < b.y0 || py >= b.y1) continue
        let enter = -Infinity
        let exit = Infinity
        let face = 0
        for (let i = 0; i < 3; i++) {
          const d = b.across[i] + rise * b.axes[i][1]
          const o = b.o[i]
          const half = b.half[i]
          if (Math.abs(d) < 1e-12) {
            if (Math.abs(o) > half) exit = -Infinity
            continue
          }
          const t0 = (-half - o) / d
          const t1 = (half - o) / d
          if (Math.min(t0, t1) > enter) {
            enter = Math.min(t0, t1)
            // 광선이 축 방향으로 가면 -쪽 면으로 들어옴
            face = 2 * i + (d > 0 ? 0 : 1)
          }
          exit = Math.min(exit, Math.max(t0, t1))
        }
        if (enter <= exit && enter > NEAR && enter < nearest) {
          nearest = enter
          pixels[py * w + px] = b.face[face]
        }
      }
    }
  }
}
