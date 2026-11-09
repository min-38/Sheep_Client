import { CELL, type Box } from './character.ts'
import type { PlayerState } from './net.ts'
import { makeCamera, type Camera } from './render.ts'

// 술집 대기실 (시스템 기획서 방 화면 M8 대기실 짜임). 손님 등 뒤 위에서 바를 내려다본 한 장면을 게임 캔버스(480×270)에 그림.
// 벽, 선반, 칠판, 술집 주인, 카운터, 바닥은 정면 그림이라 2D로 칠하고, 바 의자와 앉은 손님은 결투처럼 3D 상자로 그림(drawFigure).
// 둘이 맞게 2D도 같은 카메라로 자리를 잼. 글자가 들어가는 좌석 꼬리표, 칠판 글씨, 버튼은 또렷하게 보이게 HTML로 위에 얹음

// 현상금 = 이긴 횟수 × $100 (시스템 기획서 방 화면 현상금)
export const BOUNTY = 100

export const bountyText = (wins: number) => (wins > 0 ? `$${wins * BOUNTY}` : '')

// 판 끝 포스터 아래의 오르는 현상금. wins는 이번 승리까지 센 이긴 횟수. 첫 승리는 적힌 현상금이 없어 $0에서 오름.
// ponytail: 임시 문구. 게임 안 문구 스타일이 정해지면 바꿈
export const bountyRise = (wins: number) => `${bountyText(wins - 1) || '$0'} → ${bountyText(wins)}`

// 좌석 하나. wins는 이 방에서 이긴 횟수(최후의 1인)
export type Seat = { nickname: string; character: number; ready: boolean; mine: boolean; wins: number }

// 좌석 수는 방 인원 제한(2~8)이고, 목수건 색 번호가 곧 좌석 번호임. 나간 사람의 색은 비워 두고 다음 사람이 받으므로(컨셉 기획서 사람 구별),
// 누가 나가도 남은 사람은 제자리에 앉아 있고 새로 온 사람은 빈 좌석에 앉음. 색이 좌석 수를 넘는 사람은 없음(서버가 인원 제한까지만 받음)
export function seatSlots(players: readonly PlayerState[], myId: string | null, seats: number): (Seat | null)[] {
  const slots: (Seat | null)[] = Array(seats).fill(null)
  for (const p of players) if (p.color < seats) slots[p.color] = { nickname: p.nickname, character: p.character, ready: p.ready, mine: p.id === myId, wins: p.wins }
  return slots
}

// 이긴 횟수를 칼자국 눈금으로. 9번이 넘으면 숫자
export const tally = (wins: number) => (wins > 9 ? String(wins) : '|'.repeat(wins))

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

// 술집 주인. 장식이라 사람마다 화면에서 따로 움직이고 서버는 모름. x는 몸 가운데(px)
export type Bartender = { x: number; action: 'walk' | 'stand' | 'wipe'; target: number; until: number }

// px. 술집 주인이 다니는 범위. 가운데 술병 선반 앞이라 오른쪽 칠판과 왼쪽 빈 벽(캐릭터·색 바꾸기 자리, SHEEP-118)을 가리지 않음
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
// 술집 주인 머리 위(깊이 108블록, 키 30블록)
export const BARTENDER_TOP = Math.round(rowAt(30, 108))
const PLANK = 20
// 칠판(나무 테두리 포함)과 선반의 자리(px). 칠판 글씨는 style.css의 #chalkboard가 같은 자리에 얹음. 선반은 뒷벽 앞(깊이 118블록) 옆으로 ±30블록,
// 선반 판은 높이 22, 30, 38블록
const BOARD = { x: 352, y: 16, w: 110, h: 62 }
const SHELF = { x: Math.round(columnAt(-30, 118)), w: Math.round(columnAt(30, 118) - columnAt(-30, 118)), top: Math.round(rowAt(46, 118)), rows: [38, 30, 22].map((y) => Math.round(rowAt(y, 118))) }
const BOTTLE_COLORS = ['#2f6b3a', '#a8641c', '#b8d0c8', '#7a1e1e', '#3a4a7a', '#c8a040']

// 선반마다 늘어선 술병 [x, 너비, 높이, 색]. 늘 같은 모습이 되게 고정한 의사 난수로 한 번만 만듦
const BOTTLES = (() => {
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const bottles: [number, number, number, number, string][] = []
  for (const shelfY of SHELF.rows) {
    for (let x = SHELF.x + 6; x < SHELF.x + SHELF.w - 12; ) {
      const w = 5 + Math.floor(rand() * 3)
      bottles.push([x, shelfY, w, 12 + Math.floor(rand() * 8), BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)]])
      x += w + 3 + Math.floor(rand() * 5)
    }
  }
  return bottles
})()

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// 술집 한 장면을 480×270 캔버스에 그림. 뒤에서 앞으로: 벽, 칠판, 선반과 술병, 술집 주인, 카운터, 바닥. 의자와 손님은 이 위에 3D로 그림
export function drawSaloon(ctx: CanvasRenderingContext2D, b: Bartender, now: number) {
  for (let x = 0; x < 480; x += PLANK) {
    rect(ctx, (x / PLANK) % 2 ? '#5e3a21' : '#6b4226', x, 0, PLANK, WALL_BOTTOM)
    rect(ctx, '#3d2412', x, 0, 1, WALL_BOTTOM)
  }
  rect(ctx, '#3d2412', 0, 0, 480, 6)
  rect(ctx, '#4a2c16', 0, 6, 480, 2)

  rect(ctx, '#8a5a32', BOARD.x, BOARD.y, BOARD.w, BOARD.h)
  rect(ctx, '#23302a', BOARD.x + 4, BOARD.y + 4, BOARD.w - 8, BOARD.h - 8)

  rect(ctx, '#3f2614', SHELF.x, SHELF.top, SHELF.w, COUNTER_BACK_Y - SHELF.top)
  for (const [x, shelfY, w, h, color] of BOTTLES) {
    rect(ctx, color, x, shelfY - h, w, h - 4)
    rect(ctx, color, x + w / 2 - 1, shelfY - h - 3, 2, 4)
    rect(ctx, '#ffffff40', x + 1, shelfY - h + 2, 1, h - 8)
  }
  for (const y of SHELF.rows) rect(ctx, '#9a6a3c', SHELF.x, y, SHELF.w, 3)

  drawBartender(ctx, b, now)

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

// 모자 없이 기름 바른 머리와 콧수염, 흰 셔츠, 나비넥타이, 붉은 소매 밴드 (시스템 기획서 방 화면 술집 주인). 카운터에 허리 아래가 가림.
// 손님보다 멀어 0.8배로 그림
const BARTENDER_SCALE = 0.8
function drawBartender(ctx: CanvasRenderingContext2D, b: Bartender, now: number) {
  const bob = b.action === 'walk' ? Math.floor(now / 200) % 2 : 0
  const x = b.x
  const y = BARTENDER_TOP + bob
  const k = BARTENDER_SCALE
  // 술집 주인 그림의 한 칸. dx, dy, w, h는 0.8배 하기 전 px
  const part = (color: string, dx: number, dy: number, w: number, h: number) => rect(ctx, color, x + dx * k, y + dy * k, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)))
  const shirt = '#ece6d6'
  part('#e0ac7e', -7, 0, 14, 15)
  part('#20140c', -7, -2, 14, 5)
  part('#3a2818', -1, -2, 1, 4)
  part('#1a1a1a', -4, 6, 2, 2)
  part('#1a1a1a', 2, 6, 2, 2)
  part('#3a2414', -5, 10, 10, 2)
  part(shirt, -9, 16, 18, (COUNTER_BACK_Y - y) / k - 16)
  part('#1a1a1a', -4, 16, 8, 3)
  part('#3a3a3a', -1, 16, 2, 3)
  // 왼팔은 늘 내리고, 잔을 닦을 때만 오른팔을 들어 잔을 원을 그리며 문지름
  part(shirt, -14, 17, 5, 30)
  part('#b02a2a', -14, 27, 5, 3)
  if (b.action === 'wipe') {
    const dx = Math.round(Math.sin(now / 150) * 2)
    const dy = Math.round(Math.cos(now / 150) * 2)
    part(shirt, 9, 8, 5, 22)
    part('#b02a2a', 9, 14, 5, 3)
    part('#cfe3e8', 6, -2, 7, 10)
    part('#f4f0e4', 8 + dx, 2 + dy, 6, 5)
  } else {
    part(shirt, 9, 17, 5, 30)
    part('#b02a2a', 9, 27, 5, 3)
  }
}
