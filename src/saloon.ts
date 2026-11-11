import { CELL, type Body, type Box, type Figure } from './character.ts'
import type { PlayerState } from './net.ts'
import type { Hand } from './settings.ts'
import { makeCamera, type Camera } from './render.ts'

// 술집 대기실 (시스템 기획서 방 화면 M8 대기실 짜임). 손님 등 뒤 위에서 바를 내려다본 한 장면을 게임 캔버스(480×270)에 그림.
// 벽, 선반, 칠판, 술집 주인, 카운터, 바닥은 정면 그림이라 2D로 칠하고, 바 의자와 앉은 손님은 결투처럼 3D 상자로 그림(drawFigure).
// 둘이 맞게 2D도 같은 카메라로 자리를 잼. 글자가 들어가는 좌석 꼬리표, 칠판 글씨, 버튼은 또렷하게 보이게 HTML로 위에 얹음

// 현상금 = 이긴 횟수 × $100 (시스템 기획서 방 화면 현상금)
export const BOUNTY = 100

export const bountyText = (wins: number) => (wins > 0 ? `$${wins * BOUNTY}` : '')

// 좌석 하나. color는 사람 색 번호이고 앉은 사람의 핵심 파츠를 칠함. wins는 이 방에서 이긴 횟수(최후의 1인)
export type Seat = { nickname: string; character: number; color: number; hand: Hand; ready: boolean; mine: boolean; wins: number }

// 좌석 수는 방 인원 제한(2~8)이고, 서버가 준 좌석 번호(seat)에 앉음. 나간 사람의 좌석은 비워 두고 다음 사람이 받으므로,
// 누가 나가도 남은 사람은 제자리에 앉아 있고 새로 온 사람은 빈 좌석에 앉음. 색을 바꿔도 자리는 그대로임 (SHEEP-118).
// 좌석 번호가 좌석 수를 넘는 사람은 없음(서버가 인원 제한까지만 받음)
export function seatSlots(players: readonly PlayerState[], myId: string | null, seats: number): (Seat | null)[] {
  const slots: (Seat | null)[] = Array(seats).fill(null)
  for (const p of players) if (p.seat < seats) slots[p.seat] = { nickname: p.nickname, character: p.character, color: p.color, hand: p.hand, ready: p.ready, mine: p.id === myId, wins: p.wins }
  return slots
}

// 카메라 (블록 단위, 1블록 = 0.03칸). 눈높이 60블록에서 손님 등과 카운터 너머를 내려다봄. 위아래 시선은 결투처럼 화면을 미는 것(y-shearing)이라
// 세로선이 곧게 서서 정면 2D 그림과 맞음. 깊이는 카메라에서 앞으로 간 거리
const PROJ = 400
const EYE = 60
// 눈높이 수평선이 그려지는 화면 줄. 화면 위 밖이라 모든 것을 위에서 봄
const HORIZON = -30
const SEAT_DEPTH = 82
// 좌석 사이(블록). 어깨 폭(10블록)보다 조금 넓음
const SEAT_GAP = 11
const COUNTER_DEPTH = 88.5
const COUNTER_BACK = 103
const PANEL_DEPTH = 92
const COUNTER_HEIGHT = 19
const WALL_DEPTH = 120

// 높이 y(블록), 깊이 d(블록)인 점의 화면 줄과, 옆으로 x(블록, 오른쪽 +)인 점의 화면 칸
const rowAt = (y: number, d: number) => HORIZON + (PROJ * (EYE - y)) / d
const columnAt = (x: number, d: number) => 240 + (PROJ * x) / d

// 3D로 그리는 카메라. 투영 거리가 PROJ px가 되는 시야각이고, 수평선이 HORIZON에 오는 위아래 시선
export const SALOON_CAMERA: Camera = { ...makeCamera(0, 0, 0, (360 / Math.PI) * Math.atan(240 / PROJ), Math.atan((HORIZON - 135) / PROJ)), z: EYE * CELL }

// seats개 좌석 중 i번의 가운데(블록, 오른쪽 +). 0번이 왼쪽 끝
const seatX = (i: number, seats: number) => (i - (seats - 1) / 2) * SEAT_GAP

// i번 좌석의 결투장 좌표(칸). 카메라는 +x를 보고 화면 오른쪽이 +y. 손님은 카운터 쪽(+x)을 봄
export const seatSpot = (i: number, seats: number) => ({ x: SEAT_DEPTH * CELL, y: seatX(i, seats) * CELL, facing: 0 })

// i번 좌석 꼬리표의 아래 가운데(px). 모자 꼭대기(32블록) 조금 위
export const seatTag = (i: number, seats: number) => ({ x: columnAt(seatX(i, seats), SEAT_DEPTH), y: rowAt(34, SEAT_DEPTH) })

const hex = (c: string): readonly [number, number, number] => {
  const n = parseInt(c.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
// from~to 상자 (블록, 캐릭터 모델 좌표)
const box = (from: readonly number[], to: readonly number[], color: string): Box => ({
  c: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
  axes: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  half: [(to[0] - from[0]) / 2, (to[1] - from[1]) / 2, (to[2] - from[2]) / 2],
  rgb: hex(color),
})

// 바 의자. 손님 모델 좌표 그대로라 앉은 엉덩이(허벅지 아래 14.75블록)가 붉은 가죽 방석에 닿음
export const STOOL: readonly Box[] = [
  box([-3, 13.4, -2.6], [3, 14.75, 3.4], '#7a2e22'),
  box([-3.2, 12.8, -2.8], [3.2, 13.4, 3.6], '#4a2a14'),
  box([-0.7, 0.6, -0.1], [0.7, 12.8, 1.3], '#3a2a1a'),
  box([-2.6, 5, -1.9], [2.6, 5.6, 2.9], '#8a6a3a'),
  box([-2.4, 0, -1.8], [2.4, 0.6, 2.8], '#2a1a10'),
]

// ms. 방 코드를 복사했다는 알림을 칠판에 띄워 두는 시간 (SHEEP-114)
export const COPIED_MS = 1500

// 클립보드가 막혀 직접 복사할 때 누를 키. 애플 기기는 Command
export const copyKeys = (userAgent: string) => (/Mac|iPhone|iPad/.test(userAgent) ? '⌘C' : 'Ctrl+C')

// 술집 주인 말풍선 (시스템 기획서 방 화면 술집 주인 말풍선, SHEEP-116). 사람마다 화면에서 따로 무작위이고 서버는 모름.
// ms. 방에 들어와 첫 말까지, 말 사이 간격(25~45초), 띄워 두는 시간. ponytail: 임시 값. 플레이해 보며 정함
export const CHATTER_FIRST = 8000
export const CHATTER_GAP = [25000, 45000] as const
export const CHATTER_SHOW = 6000

// 대사 종류. 팁과 농담 반반
export type Line = { kind: 'tips' | 'jokes'; index: number }
// line은 지금 띄운 대사이고 없으면 null. until은 지우는 시각, next는 다음 말을 꺼내는 시각, last는 바로 앞 대사
export type Chatter = { line: Line | null; until: number; next: number; last: Line | null }

export const startChatter = (now: number): Chatter => ({ line: null, until: 0, next: now + CHATTER_FIRST, last: null })

// counts는 언어 파일의 팁과 농담 수. 바로 앞 대사는 다시 고르지 않음
export function stepChatter(c: Chatter, now: number, counts: Record<Line['kind'], number>, rand: () => number): Chatter {
  if (c.line) return now < c.until ? c : { ...c, line: null, next: now + CHATTER_GAP[0] + rand() * (CHATTER_GAP[1] - CHATTER_GAP[0]) }
  if (now < c.next) return c
  const kind = rand() < 0.5 ? 'tips' : 'jokes'
  let index = Math.floor(rand() * counts[kind])
  if (c.last?.kind === kind && c.last.index === index) index = (index + 1) % counts[kind]
  const line = { kind, index } as const
  return { line, until: now + CHATTER_SHOW, next: 0, last: line }
}

// 술집 주인. 장식이라 사람마다 화면에서 따로 움직이고 서버는 모름. x는 몸 가운데(px)
export type Bartender = { x: number; action: 'walk' | 'stand' | 'wipe'; target: number; until: number }

// px. 술집 주인이 다니는 범위. 가운데 술병 선반 앞이라 오른쪽 칠판과 왼쪽 벽의 현상금 게시판(캐릭터·색 바꾸기, SHEEP-118)을 가리지 않음
export const BAR_LEFT = 150
export const BAR_RIGHT = 330
// px/ms. ponytail: 임시 값. 화면을 보며 맞춤
const WALK_SPEED = 0.03

export const startBartender = (now: number): Bartender => ({ x: (BAR_LEFT + BAR_RIGHT) / 2, action: 'stand', target: 0, until: now + 1000 })

// 걷기는 고른 자리에 닿을 때까지, 서 있기(1~3초)와 잔 닦기(2~4초)는 고른 시간 동안 한 뒤 다음 것을 무작위로 고름.
// ponytail: 잔 닦는 시간은 임시 값. 시스템 기획서에는 서 있는 시간만 정함
export function stepBartender(b: Bartender, now: number, dt: number, rand: () => number): Bartender {
  if (b.action === 'walk') {
    const step = WALK_SPEED * dt
    if (Math.abs(b.target - b.x) > step) return { ...b, x: b.x + Math.sign(b.target - b.x) * step }
    b = { ...b, x: b.target }
  } else if (now < b.until) {
    return b
  }
  const pick = rand()
  if (pick < 1 / 3) return { ...b, action: 'walk', target: BAR_LEFT + rand() * (BAR_RIGHT - BAR_LEFT) }
  if (pick < 2 / 3) return { ...b, action: 'stand', until: now + 1000 + rand() * 2000 }
  return { ...b, action: 'wipe', until: now + 2000 + rand() * 2000 }
}

// px. 같은 카메라로 잰 자리 (반올림). 벽 아래 끝, 카운터 윗면 안쪽·바깥 끝, 윗판 아래, 앞판 아래(바닥과 닿는 곳), 발걸이
const WALL_BOTTOM = Math.round(rowAt(0, WALL_DEPTH))
const COUNTER_BACK_Y = Math.round(rowAt(COUNTER_HEIGHT, COUNTER_BACK))
const COUNTER_FRONT_Y = Math.round(rowAt(COUNTER_HEIGHT, COUNTER_DEPTH))
const SLAB_BOTTOM = Math.round(rowAt(17.4, COUNTER_DEPTH))
const PANEL_BOTTOM = Math.round(rowAt(0, PANEL_DEPTH))
const RAIL_Y = Math.round(rowAt(2, PANEL_DEPTH))
// 블록. 술집 주인이 서는 깊이. 카운터 안쪽 끝(103) 너머, 선반(118) 앞
const BARTENDER_DEPTH = 108
// 술집 주인 머리 위(키 30블록)
export const BARTENDER_TOP = Math.round(rowAt(30, BARTENDER_DEPTH))
const PLANK = 20
// 칠판(나무 테두리 포함)과 선반의 자리(px). 칠판은 방 코드만 적어 낮음. 글씨는 style.css의 #chalkboard가, 그 아래 나무 판 버튼은 #board-buttons가
// 얹음 (사용자 결정 2026-11-11, SHEEP-170 시안 B). 선반은 뒷벽 앞(깊이 118블록) 옆으로 ±30블록이고, 위에 방 이름 간판을 걸 자리를 비우려고
// 맨 위를 46블록에서 37블록으로, 선반 판을 높이 18, 24.5, 31블록으로 낮춤 (SHEEP-168)
const BOARD = { x: 352, y: 10, w: 110, h: 30 }
const SHELF = { x: Math.round(columnAt(-30, 118)), w: Math.round(columnAt(30, 118) - columnAt(-30, 118)), top: Math.round(rowAt(37, 118)), rows: [31, 24.5, 18].map((y) => Math.round(rowAt(y, 118))) }
// 술장 위 방 이름 간판(px). 벽에 바로 붙인 검은 판에 금박 테. 글씨는 style.css의 #saloon-sign이 같은 자리에 얹음 (SHEEP-168 시안 B)
const SIGN = { x: SHELF.x - 3, y: 14, w: SHELF.w + 6, h: 26 }
const BOTTLE_COLORS = ['#2f6b3a', '#a8641c', '#b8d0c8', '#7a1e1e', '#3a4a7a', '#c8a040', '#5a3a14', '#8a9a3a']

// px. 왼쪽 벽 장식(소뿔 해골)의 오른쪽 끝. 캐릭터·색 바꾸기 게시판이 있던 자리(x 8~116)이고, 그 게시판은 칠판의 버튼으로 엶 (SHEEP-170)
export const DECOR_RIGHT = 116
// px. 말풍선 폭의 절반(style.css #bartender-line 폭과 같음)
const BUBBLE_HALF = 75
// 말풍선 가운데(px). 술집 주인 머리 위를 따르되 오른쪽 칠판과 왼쪽 현상금 게시판에 걸리지 않게 안쪽으로 당김
export const bubbleX = (x: number) => Math.min(Math.max(x, DECOR_RIGHT + 4 + BUBBLE_HALF), BOARD.x - 4 - BUBBLE_HALF)

// 술병 모양 (SHEEP-139). 목이 긴 포도주병, 어깨가 각지고 상표를 붙인 위스키병, 손잡이 달린 낮은 항아리
type BottleKind = 'wine' | 'whiskey' | 'jug'
// 선반마다 늘어선 술병 [x, 선반 높이, 너비, 높이, 색, 모양]. 늘 같은 모습이 되게 고정한 의사 난수로 한 번만 만듦
const BOTTLES = (() => {
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const bottles: [number, number, number, number, string, BottleKind][] = []
  for (const shelfY of SHELF.rows) {
    for (let x = SHELF.x + 6; x < SHELF.x + SHELF.w - 14; ) {
      const pick = rand()
      const kind: BottleKind = pick < 0.45 ? 'wine' : pick < 0.85 ? 'whiskey' : 'jug'
      const w = kind === 'jug' ? 8 : kind === 'whiskey' ? 6 + Math.floor(rand() * 2) : 5
      const h = kind === 'jug' ? 10 + Math.floor(rand() * 3) : kind === 'wine' ? 16 + Math.floor(rand() * 4) : 12 + Math.floor(rand() * 4)
      bottles.push([x, shelfY, w, h, BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)], kind])
      x += w + (kind === 'jug' ? 5 : 3) + Math.floor(rand() * 4)
    }
  }
  return bottles
})()

// 술병 하나. 바닥이 선반 높이 shelfY에 닿음. 몸통, 좁아지는 어깨, 목, 코르크나 놋쇠 마개, 상표, 유리에 비친 빛과 그늘
function drawBottle(ctx: CanvasRenderingContext2D, x: number, shelfY: number, w: number, h: number, color: string, kind: BottleKind) {
  const neck = kind === 'wine' ? 6 : kind === 'whiskey' ? 3 : 2
  const top = shelfY - h
  const body = h - neck
  rect(ctx, color, x, top + neck, w, body)
  rect(ctx, color, x + 1, top + neck - 1, w - 2, 1)
  rect(ctx, color, x + Math.floor(w / 2) - 1, top, 2, neck)
  rect(ctx, kind === 'whiskey' ? '#c9a227' : '#8a5a32', x + Math.floor(w / 2) - 1, top - 1, 2, 2)
  if (kind === 'jug') {
    // 옆에 붙은 손잡이 고리
    rect(ctx, color, x + w, top + neck + 1, 1, 4)
    rect(ctx, '#00000030', x, top + neck, w, 2)
  } else {
    // 누런 상표와 그 위의 짙은 글씨 줄
    const labelY = top + neck + Math.round(body * 0.35)
    rect(ctx, '#e8dcb8', x, labelY, w, Math.max(3, Math.round(body * 0.3)))
    rect(ctx, '#5a3a20', x + 1, labelY + 1, w - 2, 1)
  }
  rect(ctx, '#ffffff50', x + 1, top + neck + 1, 1, body - 3)
  rect(ctx, '#00000040', x + w - 1, top + neck, 1, body)
}

// 술집 주인을 3D 블록 사람으로 그릴 자리와 모습 (SHEEP-139). x(px)를 카운터 뒤 깊이의 옆 자리(블록)로 바꿈. 화면 오른쪽이 +y.
// 서 있거나 잔을 닦을 땐 손님(카메라) 쪽을, 걸을 땐 가는 쪽을 봄. 허리 아래는 카운터에 가려 권총집 총은 빼고 그림
export function bartenderFigure(b: Bartender, now: number, body: Pick<Body, 'stand' | 'walk' | 'wipe'>): Figure {
  const side = ((b.x - 240) * BARTENDER_DEPTH) / PROJ
  const pose = b.action === 'walk' ? body.walk(now) : b.action === 'wipe' ? body.wipe(now) : body.stand(now)
  const facing = b.action === 'walk' ? (b.target >= b.x ? Math.PI / 2 : -Math.PI / 2) : Math.PI
  return { x: BARTENDER_DEPTH * CELL, y: side * CELL, facing, boxes: pose.boxes, gun: [] }
}

// 왼쪽 벽의 소뿔 해골 (SHEEP-170 시안 B). 나무 방패 판에 걸린 소 머리뼈와 양옆으로 길게 휜 뿔. 캔버스 px로 x 14~110, y 12~68
function drawSkull(ctx: CanvasRenderingContext2D) {
  rect(ctx, '#4a2c16', 46, 18, 32, 46)
  rect(ctx, '#6b4325', 48, 20, 28, 42)
  rect(ctx, '#7a5030', 48, 20, 28, 2)
  ctx.lineCap = 'round'
  for (const [width, color] of [[7, '#3d2412'], [5, '#e9dcc0']] as const) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(56, 30)
    ctx.bezierCurveTo(40, 32, 22, 30, 16, 16)
    ctx.moveTo(68, 30)
    ctx.bezierCurveTo(84, 32, 102, 30, 108, 16)
    ctx.stroke()
  }
  rect(ctx, '#8a7a62', 14, 13, 4, 4)
  rect(ctx, '#8a7a62', 106, 13, 4, 4)
  // 머리뼈: 넓은 이마에서 좁아지는 콧등, 검은 눈구멍과 콧구멍
  ctx.fillStyle = '#efe4cc'
  ctx.beginPath()
  ctx.moveTo(53, 26)
  ctx.lineTo(71, 26)
  ctx.lineTo(68, 48)
  ctx.lineTo(65, 58)
  ctx.lineTo(59, 58)
  ctx.lineTo(56, 48)
  ctx.closePath()
  ctx.fill()
  rect(ctx, '#d2c4a4', 60, 28, 4, 20)
  rect(ctx, '#1b130d', 55, 33, 5, 4)
  rect(ctx, '#1b130d', 64, 33, 5, 4)
  rect(ctx, '#1b130d', 60, 53, 1, 3)
  rect(ctx, '#1b130d', 63, 53, 1, 3)
}

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// 술집 한 장면을 480×270 캔버스에 그림. 뒤에서 앞으로: 벽, 칠판, 선반과 술병, 술집 주인, 카운터, 바닥. 의자와 손님은 이 위에 3D로 그림.
// 술집 주인은 3D 블록 사람이라 main.ts가 그려 넣음(drawBartender). 카운터가 그 허리 아래를 가림 (SHEEP-139)
export function drawSaloon(ctx: CanvasRenderingContext2D, drawBartender: () => void) {
  for (let x = 0; x < 480; x += PLANK) {
    rect(ctx, (x / PLANK) % 2 ? '#5e3a21' : '#6b4226', x, 0, PLANK, WALL_BOTTOM)
    rect(ctx, '#3d2412', x, 0, 1, WALL_BOTTOM)
  }
  rect(ctx, '#3d2412', 0, 0, 480, 6)
  rect(ctx, '#4a2c16', 0, 6, 480, 2)

  rect(ctx, '#8a5a32', BOARD.x, BOARD.y, BOARD.w, BOARD.h)
  rect(ctx, '#23302a', BOARD.x + 4, BOARD.y + 4, BOARD.w - 8, BOARD.h - 8)
  drawSkull(ctx)

  // 방 이름 간판: 검은 판, 금박 테 두 줄, 네 귀퉁이 놋쇠 못
  rect(ctx, '#a07a2e', SIGN.x, SIGN.y, SIGN.w, SIGN.h)
  rect(ctx, '#17110d', SIGN.x + 2, SIGN.y + 2, SIGN.w - 4, SIGN.h - 4)
  ctx.strokeStyle = '#a07a2e99'
  ctx.lineWidth = 1
  ctx.strokeRect(SIGN.x + 4.5, SIGN.y + 4.5, SIGN.w - 9, SIGN.h - 9)
  for (const [x, y] of [[SIGN.x + 3, SIGN.y + 3], [SIGN.x + SIGN.w - 5, SIGN.y + 3], [SIGN.x + 3, SIGN.y + SIGN.h - 5], [SIGN.x + SIGN.w - 5, SIGN.y + SIGN.h - 5]]) rect(ctx, '#e7bf55', x, y, 2, 2)

  // 술장 (SHEEP-139): 세로 판자를 댄 뒤판, 위에 얹은 장식 띠, 판마다 밝은 윗면과 아래 그늘
  rect(ctx, '#3f2614', SHELF.x, SHELF.top, SHELF.w, COUNTER_BACK_Y - SHELF.top)
  for (let x = SHELF.x + 9; x < SHELF.x + SHELF.w; x += 9) rect(ctx, '#33200f', x, SHELF.top, 1, COUNTER_BACK_Y - SHELF.top)
  rect(ctx, '#5e3a21', SHELF.x - 3, SHELF.top - 5, SHELF.w + 6, 5)
  rect(ctx, '#8a5a32', SHELF.x - 3, SHELF.top - 5, SHELF.w + 6, 1)
  rect(ctx, '#2a180c', SHELF.x - 3, SHELF.top, SHELF.w + 6, 1)
  for (const [x, shelfY, w, h, color, kind] of BOTTLES) drawBottle(ctx, x, shelfY, w, h, color, kind)
  for (const y of SHELF.rows) {
    rect(ctx, '#b07a44', SHELF.x, y, SHELF.w, 1)
    rect(ctx, '#9a6a3c', SHELF.x, y + 1, SHELF.w, 2)
    rect(ctx, '#2a180c80', SHELF.x, y + 3, SHELF.w, 2)
  }

  drawBartender()

  // 카운터 윗면은 위에서 내려다봐 판이 보이고, 손님 쪽 끝에 밝은 모서리
  rect(ctx, '#9a6a3c', 0, COUNTER_BACK_Y, 480, COUNTER_FRONT_Y - COUNTER_BACK_Y)
  rect(ctx, '#86592f', 0, COUNTER_BACK_Y, 480, 2)
  rect(ctx, '#c08a50', 0, COUNTER_FRONT_Y - 2, 480, 2)
  rect(ctx, '#8a5a32', 0, COUNTER_FRONT_Y, 480, SLAB_BOTTOM - COUNTER_FRONT_Y)
  rect(ctx, '#5a3418', 0, SLAB_BOTTOM, 480, PANEL_BOTTOM - SLAB_BOTTOM)
  for (let x = 8; x < 480; x += 96) rect(ctx, '#4a2a12', x, SLAB_BOTTOM + 8, 80, RAIL_Y - SLAB_BOTTOM - 16)
  rect(ctx, '#c8a040', 0, RAIL_Y, 480, 2)
  rect(ctx, '#3a2414', 0, PANEL_BOTTOM, 480, 270 - PANEL_BOTTOM)
  // 바닥 판자 이음매. 카메라 쪽으로 오며 벌어짐
  ctx.strokeStyle = '#2a180c'
  ctx.lineWidth = 1
  ctx.beginPath()
  const near = (PROJ * EYE) / (270 - HORIZON)
  for (let x = -96; x <= 96; x += 8) {
    ctx.moveTo(columnAt(x, PANEL_DEPTH), PANEL_BOTTOM)
    ctx.lineTo(columnAt(x, near), 270)
  }
  ctx.stroke()
}
