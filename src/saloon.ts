import type { PlayerState } from './net.ts'

// 술집 대기실 (시스템 기획서 방 화면 M8 대기실 짜임). 술집 안쪽을 정면에서 본 한 장면을 게임 캔버스(480×270)에 블록으로 그림.
// 글자가 들어가는 포스터, 칠판 글씨, 카운터 버튼은 또렷하게 보이게 HTML로 위에 얹음. 자리는 style.css가 같은 px를 cqw로 바꿔 맞춤

// 포스터 한 장. character는 초상화를 고르는 캐릭터 번호. bounty는 현상금 글자이고 한 번도 이기지 않았으면 빈 글자
export type Poster = { nickname: string; character: number; ready: boolean; mine: boolean; bounty: string }

// 포스터 자리 수(4장씩 2줄). 방 최대 인원과 같음
export const POSTER_SLOTS = 8
// 현상금 = 이긴 횟수 × $100 (시스템 기획서 방 화면 현상금)
export const BOUNTY = 100

export const bountyText = (wins: number) => (wins > 0 ? `$${wins * BOUNTY}` : '')

// 판 끝 포스터 아래의 오르는 현상금. wins는 이번 승리까지 센 이긴 횟수. 첫 승리는 적힌 현상금이 없어 $0에서 오름.
// ponytail: 임시 문구. 게임 안 문구 스타일이 정해지면 바꿈
export const bountyRise = (wins: number) => `${bountyText(wins - 1) || '$0'} → ${bountyText(wins)}`

// 목수건 색 번호가 곧 자리 번호임. 나간 사람의 색은 비워 두고 다음 사람이 받으므로(컨셉 기획서 사람 구별),
// 누가 나가도 남은 사람의 포스터는 제자리에 있고 새로 온 사람은 빈자리에 붙음
export function posterSlots(players: readonly PlayerState[], myId: string | null): (Poster | null)[] {
  const slots: (Poster | null)[] = Array(POSTER_SLOTS).fill(null)
  for (const p of players) slots[p.color] = { nickname: p.nickname, character: p.character, ready: p.ready, mine: p.id === myId, bounty: bountyText(p.wins) }
  return slots
}

// ms. 방 코드를 복사했다는 알림을 칠판에 띄워 두는 시간 (SHEEP-114)
export const COPIED_MS = 1500

// 클립보드가 막혀 직접 복사할 때 누를 키. 애플 기기는 Command
export const copyKeys = (userAgent: string) => (/Mac|iPhone|iPad/.test(userAgent) ? '⌘C' : 'Ctrl+C')

// 술집 주인. 장식이라 사람마다 화면에서 따로 움직이고 서버는 모름. x는 몸 가운데(px)
export type Bartender = { x: number; action: 'walk' | 'stand' | 'wipe'; target: number; until: number }

// px. 술집 주인이 다니는 범위. 술병 선반 앞이라 왼쪽 벽의 포스터를 가리지 않음
export const BAR_LEFT = 306
export const BAR_RIGHT = 450
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

// px. 카운터 윗면. 그 위로 벽과 선반, 아래로 카운터 앞면
const COUNTER_TOP = 186
const PLANK = 24
// 칠판(나무 테두리 포함)과 선반의 자리. 칠판 글씨는 style.css의 #chalkboard가 같은 자리에 얹음
const BOARD = { x: 362, y: 14, w: 106, h: 62 }
const SHELF = { x: 286, w: 184, rows: [104, 136, 168] }
const BOTTLE_COLORS = ['#2f6b3a', '#a8641c', '#b8d0c8', '#7a1e1e', '#3a4a7a', '#c8a040']

// 선반마다 늘어선 술병 [x, 너비, 높이, 색]. 늘 같은 모습이 되게 고정한 의사 난수로 한 번만 만듦
const BOTTLES = (() => {
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const bottles: [number, number, number, number, string][] = []
  for (const shelfY of SHELF.rows) {
    for (let x = SHELF.x + 6; x < SHELF.x + SHELF.w - 12; ) {
      const w = 6 + Math.floor(rand() * 4)
      bottles.push([x, shelfY, w, 14 + Math.floor(rand() * 10), BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)]])
      x += w + 3 + Math.floor(rand() * 6)
    }
  }
  return bottles
})()

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// 술집 한 장면을 480×270 캔버스에 그림. 뒤에서 앞으로: 벽, 칠판, 선반과 술병, 술집 주인, 카운터
export function drawSaloon(ctx: CanvasRenderingContext2D, b: Bartender, now: number) {
  for (let x = 0; x < 480; x += PLANK) {
    rect(ctx, (x / PLANK) % 2 ? '#5e3a21' : '#6b4226', x, 0, PLANK, COUNTER_TOP)
    rect(ctx, '#3d2412', x, 0, 1, COUNTER_TOP)
  }
  rect(ctx, '#3d2412', 0, 0, 480, 6)
  rect(ctx, '#4a2c16', 0, 6, 480, 2)

  rect(ctx, '#8a5a32', BOARD.x, BOARD.y, BOARD.w, BOARD.h)
  rect(ctx, '#23302a', BOARD.x + 4, BOARD.y + 4, BOARD.w - 8, BOARD.h - 8)

  rect(ctx, '#3f2614', SHELF.x, SHELF.rows[0] - 30, SHELF.w, COUNTER_TOP - SHELF.rows[0] + 30)
  for (const [x, shelfY, w, h, color] of BOTTLES) {
    rect(ctx, color, x, shelfY - h, w, h - 5)
    rect(ctx, color, x + w / 2 - 1, shelfY - h - 4, 2, 5)
    rect(ctx, '#ffffff40', x + 1, shelfY - h + 2, 1, h - 9)
  }
  for (const y of SHELF.rows) rect(ctx, '#9a6a3c', SHELF.x, y, SHELF.w, 4)

  drawBartender(ctx, b, now)

  rect(ctx, '#9a6a3c', 0, COUNTER_TOP, 480, 8)
  rect(ctx, '#c08a50', 0, COUNTER_TOP, 480, 2)
  rect(ctx, '#5a3418', 0, COUNTER_TOP + 8, 480, 270 - COUNTER_TOP - 8)
  for (let x = 8; x < 480; x += 96) rect(ctx, '#4a2a12', x, COUNTER_TOP + 16, 80, 44)
  rect(ctx, '#c8a040', 0, 256, 480, 4)
}

// 모자 없이 기름 바른 머리와 콧수염, 흰 셔츠, 나비넥타이, 붉은 소매 밴드 (시스템 기획서 방 화면 술집 주인). 카운터에 허리 아래가 가림
function drawBartender(ctx: CanvasRenderingContext2D, b: Bartender, now: number) {
  const bob = b.action === 'walk' ? Math.floor(now / 200) % 2 : 0
  const x = b.x
  const y = 120 + bob
  const shirt = '#ece6d6'
  rect(ctx, '#e0ac7e', x - 7, y, 14, 15)
  rect(ctx, '#20140c', x - 7, y - 2, 14, 5)
  rect(ctx, '#3a2818', x - 1, y - 2, 1, 4)
  rect(ctx, '#1a1a1a', x - 4, y + 6, 2, 2)
  rect(ctx, '#1a1a1a', x + 2, y + 6, 2, 2)
  rect(ctx, '#3a2414', x - 5, y + 10, 10, 2)
  rect(ctx, shirt, x - 9, y + 16, 18, COUNTER_TOP - y - 16)
  rect(ctx, '#1a1a1a', x - 4, y + 16, 8, 3)
  rect(ctx, '#3a3a3a', x - 1, y + 16, 2, 3)
  // 왼팔은 늘 내리고, 잔을 닦을 때만 오른팔을 들어 잔을 원을 그리며 문지름
  rect(ctx, shirt, x - 14, y + 17, 5, 30)
  rect(ctx, '#b02a2a', x - 14, y + 27, 5, 3)
  if (b.action === 'wipe') {
    const dx = Math.round(Math.sin(now / 150) * 2)
    const dy = Math.round(Math.cos(now / 150) * 2)
    rect(ctx, shirt, x + 9, y + 8, 5, 22)
    rect(ctx, '#b02a2a', x + 9, y + 14, 5, 3)
    rect(ctx, '#cfe3e8', x + 6, y - 2, 7, 10)
    rect(ctx, '#f4f0e4', x + 8 + dx, y + 2 + dy, 6, 5)
  } else {
    rect(ctx, shirt, x + 9, y + 17, 5, 30)
    rect(ctx, '#b02a2a', x + 9, y + 27, 5, 3)
  }
}
