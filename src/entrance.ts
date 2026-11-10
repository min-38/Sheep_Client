// 술집을 나서는 장면 (사용자 결정 2026-11-10, SHEEP-137, 시안 B를 고침). 모두 준비한 뒤 카운트다운 시각까지 ENTER_MS 동안
// 바를 보던 카메라가 천천히 뒤돌아 술집 문을 보고(turn), 멈추지 않고 걸어가 스윙 도어를 쾅 밀고(pushed) 문간을 지나(zoom)
// 한낮 빛에 하얗게 번진 뒤(white) 결투장 카운트다운이 시작함. 술집 그림처럼 게임 캔버스(480×270)에 2D로 칠함.
// 문짝은 자동문처럼 옆으로 사라지지 않고 경첩을 축으로 바깥으로 튕겨 젖혀졌다 떨며 멈춤 (시안 A, 사용자 결정 2026-11-11, SHEEP-144)

// ms. 서버 RoundFlow.EnterDuration과 같아야 함. ponytail: 임시 값. 플레이해 보며 정함
export const ENTER_MS = 3000
// ms. 시작부터 다 돌 때까지, 문간을 다 지날 때까지, 하얗게 번지기 시작할 때까지
const TURN_END = 1400
const THROUGH_END = 2800
const WHITE_FROM = 2300
// 화면이 커진 배율. 문에 닿아 밀 때와 문간을 다 지났을 때. 같은 빠르기로 걸어가면 가까울수록 빨리 커져 1 / (1 - 걸은 몫)을 따름
export const DOOR_ZOOM = 1.3
const FULL_ZOOM = 4.4
// 걸어갈 거리 가운데 문에 닿을 때까지의 몫, 문에 닿는 때(ms)
const PUSH_SHARE = (1 - 1 / DOOR_ZOOM) / (1 - 1 / FULL_ZOOM)
const PUSH_AT = TURN_END + PUSH_SHARE * (THROUGH_END - TURN_END)

// turn 0~1 돈 몫, zoom 화면 배율(1부터), pushed 문을 민 뒤 지난 시간(ms, 밀기 전은 음수), white 0~1 하얗게 번진 정도
export type Entrance = { turn: number; zoom: number; pushed: number; white: number }

const clamp01 = (p: number) => Math.min(1, Math.max(0, p))

// now(서버 시계)의 장면. 카운트다운 시각(countdownAt) ENTER_MS 전부터 카운트다운 전까지만 있고, 그 밖은 null
export function entranceAt(countdownAt: number, now: number): Entrance | null {
  const ms = now - (countdownAt - ENTER_MS)
  if (ms < 0 || ms >= ENTER_MS) return null
  const t = clamp01(ms / TURN_END)
  const walked = clamp01((ms - TURN_END) / (THROUGH_END - TURN_END))
  return {
    turn: t * t * (3 - 2 * t),
    zoom: 1 / (1 - (1 - 1 / FULL_ZOOM) * walked),
    pushed: ms - PUSH_AT,
    white: clamp01((ms - WHITE_FROM) / (ENTER_MS - WHITE_FROM)),
  }
}

// 도. 문짝이 멈춰 서는 각도 (0은 닫힘, 90은 문틀과 직각으로 바깥을 향함)
export const SWING_REST = 78
// ms. 떨림이 잦아드는 시간과 한 번 떠는 주기. ponytail: 임시 값
const SWING_DECAY = 250
const SWING_PERIOD = 630

// 문을 밀고 pushed(ms) 지난 문짝 각도(도). 쾅 밀려 멈출 각도를 지나쳤다가 되돌아오며 떨다 멈춤 (줄어드는 진동)
export const swingAngle = (pushed: number) =>
  pushed <= 0 ? 0 : SWING_REST * (1 - Math.exp(-pushed / SWING_DECAY) * Math.cos((2 * Math.PI * pushed) / SWING_PERIOD))

// 문간 (px). 문틀 안으로 한낮 바깥이 보이고, 스윙 도어는 문간 가운데 높이에 매달려 위아래가 트임
const DOOR = { x: 170, y: 40, w: 140, h: 192 }
const LEAF = { top: 92, bottom: 182 }
const FLOOR_Y = 232
// 눈이 보는 점 (px). 문간 가운데, 바깥 지평선 높이. 다가갈 때 이 점으로 커지고, 젖혀진 문짝 끝도 이 점 쪽으로 줄어듦
const EYE = { x: DOOR.x + DOOR.w / 2, y: 146 }
// px. 눈에서 문까지의 거리. 작을수록 젖혀진 문짝 끝이 더 작아짐
const EYE_DIST = 160

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

// 스윙 도어 한 짝. hinge는 경첩(문틀 쪽) x, dir은 문짝이 뻗는 쪽(+1 오른쪽, -1 왼쪽). angle(도)만큼 경첩을 축으로 바깥(화면 안쪽)으로 돎.
// 문짝 끝은 멀어진 만큼 눈이 보는 점 쪽으로 줄어 사다리꼴로 보임. 90도를 넘으면 끝이 벽 뒤로 가 문간 밖은 잘림(부르는 쪽이 자름)
function drawLeaf(ctx: CanvasRenderingContext2D, hinge: number, dir: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  const w = DOOR.w / 2
  const shrink = EYE_DIST / (EYE_DIST + w * Math.sin(rad))
  const endX = EYE.x + (hinge + dir * w * Math.cos(rad) - EYE.x) * shrink
  const endY = (y: number) => EYE.y + (y - EYE.y) * shrink
  const h = LEAF.bottom - LEAF.top
  // 문짝 높이의 from~to(px) 띠를 사다리꼴로 칠함
  const band = (color: string, from: number, to: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(hinge, LEAF.top + from)
    ctx.lineTo(endX, endY(LEAF.top + from))
    ctx.lineTo(endX, endY(LEAF.top + to))
    ctx.lineTo(hinge, LEAF.top + to)
    ctx.fill()
  }
  band('#8a5a32', 0, h)
  // 위아래 가로대와 사이 살
  band('#4a2c16', 0, 6)
  band('#4a2c16', h - 6, h)
  for (let y = 12; y < h - 8; y += 8) band('#5a3418', y, y + 3)
  // 젖혀질수록 빛을 비껴 받아 어두워짐
  band(`rgba(0, 0, 0, ${0.3 * Math.sin(rad)})`, 0, h)
}

// 술집 문 쪽 벽. 벽 판자, 문틀, 바깥 빛, 스윙 도어. angle은 문짝 각도(도, 0은 닫힘)
export function drawDoorWall(ctx: CanvasRenderingContext2D, angle: number) {
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
  // 문짝은 건물 밖으로 젖혀지므로 문간 안쪽으로만 보임
  ctx.save()
  ctx.beginPath()
  ctx.rect(DOOR.x, DOOR.y, DOOR.w, DOOR.h)
  ctx.clip()
  drawLeaf(ctx, DOOR.x, 1, angle)
  drawLeaf(ctx, DOOR.x + DOOR.w, -1, angle)
  ctx.restore()
}

// 나서는 장면 한 프레임. drawBar는 바를 보는 술집 그림(손님 포함)을 그림.
// 도는 동안은 술집과 문 쪽 벽이 한 줄로 옆으로 흘러가고(카메라가 도는 모습), 다 돌면 눈이 보는 점으로 다가가며 문을 밀고 하얗게 번짐
export function drawEntrance(ctx: CanvasRenderingContext2D, e: Entrance, drawBar: () => void) {
  ctx.save()
  if (e.turn < 1) {
    ctx.translate(-Math.round(e.turn * 480), 0)
    drawBar()
    ctx.translate(480, 0)
    drawDoorWall(ctx, 0)
  } else {
    ctx.translate(EYE.x, EYE.y)
    ctx.scale(e.zoom, e.zoom)
    ctx.translate(-EYE.x, -EYE.y)
    drawDoorWall(ctx, swingAngle(e.pushed))
  }
  ctx.restore()
  if (e.white > 0) {
    ctx.fillStyle = `rgba(255, 246, 224, ${e.white})`
    ctx.fillRect(0, 0, 480, 270)
  }
}
