import './style.css'
import { record, sampleAt, type Sample } from './interpolate.ts'
import { parseServerMessage, type ClientMessage, type PlayerState } from './net.ts'
import type { Grid } from './raycast.ts'
import { makeCamera, renderFrame } from './render.ts'
import { loaded, pull, ROUNDS } from './revolver.ts'
import { makeScarecrowFrames } from './scarecrow.ts'
import type { Thing } from './sprite.ts'
import { turn } from './turn.ts'

// 내부 해상도. 이 크기로 그리고 CSS로 확대함 (기술 설계서 렌더링)
const W = 480
const H = 270
const FOV = 66
// 라디안/px. ponytail: 임시 감도. 시스템 기획서 조작의 감도가 정해지면 그 값으로 바꿈
const SENSITIVITY = 0.003
// ms. ponytail: 임시 값. 시스템 기획서 리볼버의 발사 간격이 정해지면 그 값으로 바꿈
const FIRE_INTERVAL = 250
// ms. 서버 틱(20Hz)마다 마지막 각도만 쓰므로 그보다 자주 보내지 않음
const TURN_INTERVAL = 50
// ms. 다른 플레이어는 약 두 틱 전을 그려 늘 앞뒤 두 상태 사이에 있게 함 (기술 설계서 다른 플레이어 보여 주기)
const INTERP_DELAY = 100

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')!
const image = ctx.createImageData(W, H)
const pixels = new Uint32Array(image.data.buffer)

// 서버가 보낸 결투장. 받기 전에는 그리지도 쏘지도 않음
let grid: Grid | null = null
// 입장 응답으로 받은 내 id. 받기 전의 state는 무시함 (기술 설계서 메시지)
let myId: string | null = null
// 내 위치는 서버가 정함. 처음 state를 받아 자리를 잡기 전에는 그리지 않음
let placed = false
let x = 0
let y = 0
let angle = 0
let sentAngle = 0
let sentAt = -Infinity
// 다른 플레이어마다 받은 상태. 나는 넣지 않음 (내 회전은 바로 반영)
const others = new Map<string, Sample[]>()
// ponytail: 허수아비 그림을 임시로 씀. 플레이어 스프라이트 시트가 생기면 바꿈
const scarecrow = makeScarecrowFrames()

function applyState(players: readonly PlayerState[]) {
  const me = players.find((p) => p.id === myId)
  if (!me) return
  x = me.x
  y = me.y
  // 내 각도는 시작 배치에서 한 번만 받음. 그 뒤로는 내 입력이 바로 반영되고 서버 값은 늦게 도는 메아리라 버림
  if (!placed) angle = sentAngle = me.angle
  placed = true
  record(others, players.filter((p) => p !== me), performance.now())
}

function othersAt(t: number): Thing[] {
  return [...others.values()].map((samples) => {
    const s = sampleAt(samples, t)
    return { x: s.x, y: s.y, facing: s.angle, frames: scarecrow }
  })
}

// 포인터 잠금 중에만 돌림. 잠금 전에는 커서가 화면 밖으로 나가 이동량이 끊김
canvas.addEventListener('click', () => canvas.requestPointerLock())
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) angle = turn(angle, e.movementX, SENSITIVITY)
})

const ammo = document.querySelector<HTMLOutputElement>('#ammo')!
let gun = loaded(ROUNDS)
const showAmmo = () => (ammo.value = '●'.repeat(gun.rounds) + '○'.repeat(ROUNDS - gun.rounds))
showAmmo()

// ponytail: 임시 쏘기 키(왼쪽 클릭). 시스템 기획서 조작의 쏘기 키가 정해지면 바꿈.
// 잠금 전 클릭은 잠금만 걸고 쏘지 않음
canvas.addEventListener('mousedown', (e) => {
  if (!grid || document.pointerLockElement !== canvas || e.button !== 0) return
  const next = pull(gun, e.timeStamp, FIRE_INTERVAL)
  if (!next) return
  gun = next
  // 명중은 서버가 확정함 (M4). 클라는 탄 수만 줄임
  showAmmo()
})

function frame(now: number) {
  if (grid && placed) {
    renderFrame(pixels, W, H, grid, makeCamera(x, y, angle, FOV), othersAt(now - INTERP_DELAY))
    ctx.putImageData(image, 0, 0)
    // 마우스 이벤트가 아니라 여기서 보내야 마지막으로 멈춘 각도도 빠지지 않고 감
    if (angle !== sentAngle && now - sentAt >= TURN_INTERVAL && ws.readyState === WebSocket.OPEN) {
      send({ type: 'turn', angle })
      sentAngle = angle
      sentAt = now
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

const lobby = document.querySelector<HTMLFormElement>('#lobby')!
const controls = lobby.querySelector('fieldset')!
const codeInput = document.querySelector<HTMLInputElement>('#code')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const room = document.querySelector<HTMLOutputElement>('#room')!
const REASONS = { notFound: '없는 방 코드', full: '꽉 찬 방' }

// 같은 출처의 /ws. 개발 중에는 vite가 로컬 서버로 넘김 (vite.config.ts)
const ws = new WebSocket('/ws')
const send = (m: ClientMessage) => ws.send(JSON.stringify(m))

ws.addEventListener('open', () => {
  controls.disabled = false
  status.textContent = ''
})
// 처음부터 못 붙어도 여기로 옴. ponytail: 재접속 없음. 재접속 이슈에서 다시 붙어 방으로 돌아가게 함
ws.addEventListener('close', () => {
  document.exitPointerLock()
  controls.disabled = true
  lobby.hidden = false
  room.value = ''
  status.textContent = '서버와 연결되지 않음. 새로고침해 다시 접속'
})
ws.addEventListener('message', (e) => {
  const m = parseServerMessage(e.data)
  switch (m?.type) {
    case 'roomCreated':
    case 'joined':
      lobby.hidden = true
      room.value = `방 ${m.code}`
      myId = m.playerId
      placed = false
      break
    case 'error':
      status.textContent = REASONS[m.reason]
      break
    // 방에 다시 들어와도 맵이 다시 옴 (기술 설계서 메시지)
    case 'map':
      grid = m.cells
      break
    case 'state':
      applyState(m.players)
      break
  }
})

document.querySelector('#create')!.addEventListener('click', () => send({ type: 'createRoom' }))
lobby.addEventListener('submit', (e) => {
  e.preventDefault()
  send({ type: 'joinRoom', code: codeInput.value })
})
