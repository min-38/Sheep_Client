import { HEAD } from './hitcard.ts'
import { pack } from './render.ts'
import { PX_PER_CELL, type Sprite } from './sprite.ts'

// 블록 캐릭터 (컨셉 기획서 아트). 상자를 쌓아 사람을 만들고 8방향에서 본 모습을 코드로 그림.
// 모델 좌표는 블록 단위이고 x는 그 사람의 오른쪽, y는 위, z는 앞. 원점은 두 발 사이 바닥

type V = readonly [number, number, number]
type RGB = readonly [number, number, number]
// 상자 하나. c는 가운데, axes는 세 변의 방향(단위 벡터), half는 그 방향의 반 길이
type Box = { c: V; axes: readonly [V, V, V]; half: V; rgb: RGB }

// 동작별 8방향 그림. k번째 장은 나를 보던 사람이 시계 방향으로 k·45° 돈 모습 (frameIndex와 같은 순서).
// walk는 번갈아 보여 줄 두 장, suicide는 [총을 머리에 댐, 불꽃] 두 단계
export type Poses = { stand: Sprite[]; walk: Sprite[][]; aim: Sprite[]; fire: Sprite[]; suicide: Sprite[][]; fallen: Sprite[] }

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
// 블록 한 칸의 px. 키가 판정 머리 위(HEAD.top)와 같은 높이로 그려짐
const PX = (PX_PER_CELL * HEAD.top) / TALL
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

// 오른쪽으로 쓰러져 누움. 오른쪽이 바닥, 머리가 +x. 누운 몸의 가운데가 서 있던 자리
const lay = (b: Box): Box => {
  const turn = (v: V): V => [v[1], -v[0], v[2]]
  const [x, y, z] = turn(b.c)
  return { ...b, c: [x - HAT_TOP / 2, y, z], axes: [turn(b.axes[0]), turn(b.axes[1]), turn(b.axes[2])] }
}

function build(scarf: RGB): Poses {
  const stand = figure(scarf, 0, arm(SHOULDER, down(0)), true)
  const walk = (a: number) => frames(figure(scarf, a, arm(SHOULDER, down(-a)), true))
  const aimed = (d: V, flash: boolean) => frames(figure(scarf, 0, holding(d, flash), false))
  return {
    stand: frames(stand),
    walk: [walk(SWING), walk(-SWING)],
    aim: aimed(Z, false),
    fire: aimed([0, Math.sin(RECOIL), Math.cos(RECOIL)], true),
    suicide: [false, true].map((flash) => frames(figure(scarf, 0, temple(flash), false))),
    fallen: frames(stand.map(lay)),
  }
}

const cache: Poses[] = []

// 목수건 색 번호(state의 color, 0~7)의 모든 동작 그림. 색마다 처음 부를 때 한 번 만듦.
// ponytail: 한 색에 약 0.1초 걸려 새 사람이 들어올 때 한 번 끊김. 거슬리면 픽셀마다 상자가 덮는 범위만 검사함
export const characterFrames = (color: number): Poses => (cache[color] ??= build(rgb(SCARVES[color])))

// 상자들을 8방향에서 수평으로 본 그림. 가장 낮은 곳이 그림 아래 끝(바닥), 세로축(원점)이 가로 가운데.
// 크기는 어느 쪽으로 돌아도 들어가게 세로축에서 가장 먼 꼭짓점으로 정함
function frames(boxes: Box[]): Sprite[] {
  let r = 0
  let bottom = Infinity
  let top = -Infinity
  for (const b of boxes) {
    for (let i = 0; i < 8; i++) {
      const p = b.axes.reduce((p, axis, j) => add(p, axis, (i >> j) & 1 ? b.half[j] : -b.half[j]), b.c)
      r = Math.max(r, Math.hypot(p[0], p[2]))
      bottom = Math.min(bottom, p[1])
      top = Math.max(top, p[1])
    }
  }
  const w = 2 * Math.ceil(r * PX)
  const h = Math.ceil((top - bottom) * PX)
  return Array.from({ length: 8 }, (_, k) => view(boxes, (k * Math.PI) / 4, w, h, bottom, r + 1))
}

// turned만큼 돈 사람을 정면에서 평행 광선으로 본 그림. 픽셀마다 광선이 처음 닿는 상자 면의 색을 칠함
function view(boxes: Box[], turned: number, w: number, h: number, bottom: number, far: number): Sprite {
  const cos = Math.cos(turned)
  const sin = Math.sin(turned)
  // 모델 좌표에서 화면 오른쪽과 나를 향한 쪽. 나를 보면(0) 그 사람의 오른쪽이 화면 왼쪽임
  const screenX: V = [-cos, 0, -sin]
  const toMe: V = [-sin, 0, cos]
  // 빛은 내 쪽 왼쪽 위에서 옴. 그림마다 같은 쪽이 밝아 8장이 같은 조명으로 보임
  const light = unit(add(add(Y, screenX, -1), toMe, 1.4))
  // 상자마다 광선을 상자 축 기준으로 바꿔 둠. 광선은 내 앞 far에서 나를 등지고 감
  const local = boxes.map((b) => ({
    half: b.half,
    sx: b.axes.map((a) => dot(screenX, a)),
    sy: b.axes.map((a) => a[1]),
    o: b.axes.map((a) => far * dot(toMe, a) - dot(b.c, a)),
    d: b.axes.map((a) => -dot(toMe, a)),
    // 축마다 광선이 들어가는 면의 색. 불꽃은 스스로 빛나 면 밝기를 곱하지 않음
    face: b.axes.map((a) => {
      const lit = b.rgb === FLASH ? 1 : 0.55 + 0.45 * Math.max(0, Math.sign(dot(toMe, a)) * dot(a, light))
      return pack(Math.round(b.rgb[0] * lit), Math.round(b.rgb[1] * lit), Math.round(b.rgb[2] * lit))
    }),
  }))
  const pixels = new Uint32Array(w * h)
  for (let py = 0; py < h; py++) {
    const y = bottom + (h - py - 0.5) / PX
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5 - w / 2) / PX
      let nearest = Infinity
      for (const b of local) {
        let enter = -Infinity
        let exit = Infinity
        let face = 0
        for (let i = 0; i < 3; i++) {
          const o = x * b.sx[i] + y * b.sy[i] + b.o[i]
          const half = b.half[i]
          if (Math.abs(b.d[i]) < 1e-9) {
            if (Math.abs(o) > half) exit = -Infinity
            continue
          }
          const t0 = (-half - o) / b.d[i]
          const t1 = (half - o) / b.d[i]
          if (Math.min(t0, t1) > enter) {
            enter = Math.min(t0, t1)
            face = i
          }
          exit = Math.min(exit, Math.max(t0, t1))
        }
        if (enter <= exit && enter < nearest) {
          nearest = enter
          pixels[py * w + px] = b.face[face]
        }
      }
    }
  }
  return { w, h, pixels }
}
