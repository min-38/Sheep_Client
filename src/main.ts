import './style.css'
import { parseServerMessage, type ClientMessage } from './net.ts'
import type { Grid } from './raycast.ts'
import { makeCamera, renderFrame } from './render.ts'
import { firstHit, loaded, pull, ROUNDS } from './revolver.ts'
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
// 칸. 허수아비 몸 폭(0.45칸)의 절반. ponytail: 임시 값. 시스템 기획서 리볼버의 명중 반지름이 정해지면 그 값으로 바꿈
const HIT_RADIUS = 0.225

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')!
const image = ctx.createImageData(W, H)
const pixels = new Uint32Array(image.data.buffer)

// 서버가 보낸 결투장. 받기 전에는 그리지도 쏘지도 않음
let grid: Grid | null = null
let x = 0
let y = 0
let angle = 0
let things: Thing[] = []
const scarecrow = makeScarecrowFrames()

// map을 받을 때마다 부름. 방에 다시 들어와도 맵이 다시 옴 (기술 설계서 메시지)
function enterArena(cells: Grid, width: number, height: number) {
  grid = cells
  // ponytail: 결투장 가운데에 섬. 서버가 내 시작 위치를 보내면(SHEEP-6) 그 위치로 바꿈
  x = width / 2
  y = height / 2
  // M2 혼자 쏘기용 임시 과녁. 나를 둘러 8개를 세우고, k번째는 나를 보던 데서 k·45° 돌려 8장이 모두 보이게 함
  things = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4
    const toMe = a + Math.PI
    return { x: x + 4 * Math.cos(a), y: y + 4 * Math.sin(a), facing: toMe + a, frames: scarecrow }
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
  showAmmo()
  const i = firstHit(grid, x, y, angle, things, HIT_RADIUS)
  // 쓰러지는 그림이 생기기 전까지는 맞은 허수아비를 결투장에서 뺌
  if (i >= 0) things.splice(i, 1)
})

function frame() {
  if (grid) {
    renderFrame(pixels, W, H, grid, makeCamera(x, y, angle, FOV), things)
    ctx.putImageData(image, 0, 0)
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
      break
    case 'error':
      status.textContent = REASONS[m.reason]
      break
    case 'map':
      enterArena(m.cells, m.width, m.height)
      break
  }
})

document.querySelector('#create')!.addEventListener('click', () => send({ type: 'createRoom' }))
lobby.addEventListener('submit', (e) => {
  e.preventDefault()
  send({ type: 'joinRoom', code: codeInput.value })
})
