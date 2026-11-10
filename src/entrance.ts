// 술집을 나서는 장면 (사용자 결정 2026-11-10, SHEEP-137, 시안 B를 고침). 모두 준비한 뒤 카운트다운 시각까지 ENTER_MS 동안
// 바를 보던 카메라가 천천히 뒤돌아 술집 문을 보고(turn), 스윙 도어가 바깥으로 열리고(open), 문 밖으로 곧장 나아가
// 한낮 빛에 하얗게 번진 뒤(push) 결투장 카운트다운이 시작함. 술집 그림처럼 게임 캔버스(480×270)에 2D로 칠함

// ms. 서버 RoundFlow.EnterDuration과 같아야 함. ponytail: 임시 값. 플레이해 보며 정함
export const ENTER_MS = 3000
// ms. 시작부터 다 돌 때까지, 문이 다 열릴 때까지
const TURN_END = 1400
const OPEN_END = 2000

export type Entrance = { turn: number; open: number; push: number }

const smooth = (from: number, to: number, ms: number) => {
  const p = Math.min(1, Math.max(0, (ms - from) / (to - from)))
  return p * p * (3 - 2 * p)
}

// now(서버 시계)의 장면. 카운트다운 시각(countdownAt) ENTER_MS 전부터 카운트다운 전까지만 있고, 그 밖은 null.
// 셋 다 0~1. push는 나아가는 동안 고르게 빨라지게 smoothstep 대신 제곱
export function entranceAt(countdownAt: number, now: number): Entrance | null {
  const ms = now - (countdownAt - ENTER_MS)
  if (ms < 0 || ms >= ENTER_MS) return null
  const p = Math.max(0, (ms - OPEN_END) / (ENTER_MS - OPEN_END))
  return { turn: smooth(0, TURN_END, ms), open: smooth(TURN_END, OPEN_END, ms), push: p * p }
}

// 문간 (px). 문틀 안으로 한낮 바깥이 보이고, 스윙 도어는 문간 가운데 높이에 매달려 위아래가 트임
const DOOR = { x: 170, y: 40, w: 140, h: 192 }
const LEAF = { top: 92, bottom: 182 }
const FLOOR_Y = 232

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

// 스윙 도어 한 짝. hinge는 문틀 쪽 x, dir은 열리는 쪽(+1 오른쪽 짝, -1 왼쪽 짝 거울). 바깥으로 열려 보이는 폭이 cos로 줄고 어두워짐
function drawLeaf(ctx: CanvasRenderingContext2D, hinge: number, dir: number, open: number) {
  const full = DOOR.w / 2
  const w = Math.max(1, Math.round(full * Math.cos((open * 80 * Math.PI) / 180)))
  const x = dir > 0 ? hinge - w : hinge
  const h = LEAF.bottom - LEAF.top
  rect(ctx, open > 0.5 ? '#6a4024' : '#8a5a32', x, LEAF.top, w, h)
  // 위아래 가로대와 사이 살
  rect(ctx, '#4a2c16', x, LEAF.top, w, 6)
  rect(ctx, '#4a2c16', x, LEAF.bottom - 6, w, 6)
  for (let y = LEAF.top + 12; y < LEAF.bottom - 8; y += 8) rect(ctx, '#5a3418', x, y, w, 3)
  // 가운데 쪽 끝의 둥근 머리
  rect(ctx, '#4a2c16', dir > 0 ? x : x + w - 3, LEAF.top - 6, 3, 6)
}

// 술집 문 쪽 벽. 벽 판자, 문틀, 바깥 빛, 스윙 도어. open 0은 닫힘, 1은 바깥으로 다 열림
export function drawDoorWall(ctx: CanvasRenderingContext2D, open: number) {
  for (let x = 0; x < 480; x += 24) {
    rect(ctx, (x / 24) % 2 ? '#5e3a21' : '#6b4226', x, 0, 24, FLOOR_Y)
    rect(ctx, '#3d2412', x, 0, 1, FLOOR_Y)
  }
  rect(ctx, '#3d2412', 0, 0, 480, 6)
  rect(ctx, '#3a2414', 0, FLOOR_Y, 480, 270 - FLOOR_Y)
  // 바깥. 한낮 하늘과 모래가 하얗게 바래 보임
  const sky = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h)
  sky.addColorStop(0, '#fff3d6')
  sky.addColorStop(0.55, '#ffe2a8')
  sky.addColorStop(0.56, '#f0c88a')
  sky.addColorStop(1, '#e2b071')
  ctx.fillStyle = sky
  ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h)
  // 문틀
  rect(ctx, '#3d2412', DOOR.x - 8, DOOR.y - 10, DOOR.w + 16, 10)
  rect(ctx, '#3d2412', DOOR.x - 8, DOOR.y, 8, DOOR.h)
  rect(ctx, '#3d2412', DOOR.x + DOOR.w, DOOR.y, 8, DOOR.h)
  // 문간으로 들어온 빛이 바닥에 깔림
  ctx.fillStyle = '#ffe2a840'
  ctx.beginPath()
  ctx.moveTo(DOOR.x, FLOOR_Y)
  ctx.lineTo(DOOR.x + DOOR.w, FLOOR_Y)
  ctx.lineTo(DOOR.x + DOOR.w + 60, 270)
  ctx.lineTo(DOOR.x - 60, 270)
  ctx.fill()
  drawLeaf(ctx, DOOR.x, -1, open)
  drawLeaf(ctx, DOOR.x + DOOR.w, 1, open)
}

// 나서는 장면 한 프레임. drawBar는 바를 보는 술집 그림(손님 포함)을 그림.
// 도는 동안은 술집과 문 쪽 벽이 한 줄로 옆으로 흘러가고(카메라가 도는 모습), 다 돌면 문이 열리고, 문간 가운데로 다가가며 하얗게 번짐
export function drawEntrance(ctx: CanvasRenderingContext2D, e: Entrance, drawBar: () => void) {
  ctx.save()
  if (e.turn < 1) {
    ctx.translate(-Math.round(e.turn * 480), 0)
    drawBar()
    ctx.translate(480, 0)
    drawDoorWall(ctx, 0)
  } else {
    const s = 1 + 5 * e.push
    const cx = DOOR.x + DOOR.w / 2
    const cy = (LEAF.top + LEAF.bottom) / 2
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.translate(-cx, -cy)
    drawDoorWall(ctx, e.open)
  }
  ctx.restore()
  if (e.push > 0.3) {
    ctx.fillStyle = `rgba(255, 246, 224, ${Math.min(1, (e.push - 0.3) / 0.7)})`
    ctx.fillRect(0, 0, 480, 270)
  }
}
