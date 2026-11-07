import './style.css'
import { best, measure, toLocalTime, toServerTime, type ClockSample } from './clock.ts'
import { record, sampleAt, type Sample } from './interpolate.ts'
import { fireMessage, parseServerMessage, type ClientMessage, type PlayerState, type RoundResult } from './net.ts'
import type { Grid } from './raycast.ts'
import { makeCamera, renderFrame } from './render.ts'
import { loaded, pull, ROUNDS } from './revolver.ts'
import { banner, dueling, locked, resultText, type Schedule } from './round.ts'
import { makeFallenFrames, makeScarecrowFrames } from './scarecrow.ts'
import { heardFrom, playShot, playSignal, stampOf, toAudioTime } from './sound.ts'
import type { Thing } from './sprite.ts'
import { aimAt, crosshairOffset, sway } from './sway.ts'
import { tilt, turn } from './turn.ts'

// 내부 해상도. 이 크기로 그리고 CSS로 확대함 (기술 설계서 렌더링)
const W = 480
const H = 270
const FOV = 66
// 투영면까지의 거리(px). renderFrame과 같은 값이라야 조준점이 총알이 갈 곳에 놓임
const PROJ = W / (2 * Math.tan((FOV * Math.PI) / 360))
// 라디안/px. ponytail: 임시 감도. 시스템 기획서 조작의 감도가 정해지면 그 값으로 바꿈
const SENSITIVITY = 0.003
// ms. 시스템 기획서 리볼버 발사 간격. 서버와 같은 값이어야 내가 센 탄 수가 서버와 어긋나지 않음
const FIRE_INTERVAL = 250
// ms. 발사 불꽃을 띄워 두는 시간. ponytail: 임시 값(시스템 기획서 HUD). 플레이해 보며 다시 정함
const FLASH_SHOWN = 100
// ms. 서버 틱(20Hz)마다 마지막 각도만 쓰므로 그보다 자주 보내지 않음
const TURN_INTERVAL = 50
// ms. 다른 플레이어는 약 두 틱 전을 그려 늘 앞뒤 두 상태 사이에 있게 함 (기술 설계서 다른 플레이어 보여 주기)
const INTERP_DELAY = 100
// 한 번 맞출 때 재는 횟수. 그중 왕복이 가장 짧은 값을 씀 (기술 설계서 시간 맞추기)
const SYNC_COUNT = 5

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
let angle = 0
// 위아래 시선(라디안, 위가 +). 내 화면에만 쓰고 발사에 실어 보냄. turn처럼 서버에 따로 보내지 않음
let pitch = 0
let sentAngle = 0
let sentAt = -Infinity
// 플레이어마다 받은 상태. 나도 넣어 서버가 나를 걷게 할 때 다른 사람과 같이 보간해 그림
const history = new Map<string, Sample[]>()
// ponytail: 허수아비 그림을 임시로 씀. 플레이어 스프라이트 시트가 생기면 바꿈
const scarecrow = makeScarecrowFrames()
const firing = makeScarecrowFrames(true)
const fallen = makeFallenFrames()
// 다른 사람이 마지막으로 쏜 것과 쓰러진 것을 받은 시각(ms). state처럼 INTERP_DELAY 뒤에 보여 줘 돌기, 발사, 쓰러짐의 순서를 지킴.
// ponytail: 사람마다 마지막 발사 하나만 둠. 발사 간격(250ms)이 불꽃(100ms)보다 길어 겹치지 않음. 지연이 크게 흔들려 둘이 붙어 오면 앞 불꽃이 빠짐
const shots = new Map<string, { at: number; angle: number }>()
const downAt = new Map<string, number>()
const isDown = (id: string, t: number) => (downAt.get(id) ?? Infinity) <= t
// 서버가 알린 판 결과와 받은 시각(ms). 탈락처럼 INTERP_DELAY 뒤에 띄움.
// end는 결과 바로 뒤에 오는 phase의 시각(서버 시계, 승리면 lobby, 재대결이면 countdown)이고 이때 endResult로 끝냄
let result: (RoundResult & { at: number; end?: number }) | null = null

function applyState(players: readonly PlayerState[]) {
  const me = players.find((p) => p.id === myId)
  if (!me) return
  const now = performance.now()
  // 내 각도는 시작 배치에서 한 번만 받음. 그 뒤로는 내 입력이 바로 반영되고 서버 값은 늦게 도는 메아리라 버림.
  // 잠긴 동안은 서버가 나를 돌리므로 따름. 그래야 풀리는 순간 서버가 돌려 둔 쪽에서 이어 돎
  if (!placed || inputLocked(now)) angle = sentAngle = me.angle
  placed = true
  record(history, players, now)
  // 내 준비 여부도 서버가 정함. 누르면 이 값을 뒤집어 보냄
  ready = me.ready
  readyButton.textContent = ready ? '준비 풀기' : '준비'
  const count = `준비 ${players.filter((p) => p.ready).length}/${players.length}`
  // 같은 글자를 틱마다 다시 넣으면 화면 낭독기가 되풀이해 읽음
  if (readyCount.value !== count) readyCount.value = count
}

// 지금 내 자리와 시선. 자리는 다른 사람처럼 INTERP_DELAY 전이고, 시선은 잠긴 동안 서버가 돌린 각도, 아니면 내 입력
function myView(now: number) {
  const me = sampleAt(history.get(myId!)!, now - INTERP_DELAY)
  return { x: me.x, y: me.y, angle: inputLocked(now) ? me.angle : angle }
}

// 다른 사람의 발사. 불꽃과 총소리 모두 state처럼 INTERP_DELAY 뒤에 내어 돌기, 발사, 쓰러짐의 순서를 지킴.
// ponytail: 총소리 방향은 받은 순간의 내 시선으로 정함. 소리가 나기까지 0.1초와 나는 동안 돌면 그만큼 어긋남. 거슬리면 프레임마다 AudioListener를 내 시선으로 돌림
function showShot(id: string, shotAngle: number) {
  const now = performance.now()
  shots.set(id, { at: now, angle: shotAngle })
  const samples = history.get(id)
  if (!audio || !placed || !samples) return
  const view = myView(now)
  const shooter = sampleAt(samples, now - INTERP_DELAY)
  playShot(audio, toAudioTime(now + INTERP_DELAY, stampOf(audio)), heardFrom(view.x, view.y, view.angle, shooter.x, shooter.y))
}

function othersAt(t: number): Thing[] {
  return [...history]
    .filter(([id]) => id !== myId)
    .map(([id, samples]) => {
      const s = sampleAt(samples, t)
      const shot = shots.get(id)
      const flashing = shot !== undefined && t >= shot.at && t < shot.at + FLASH_SHOWN
      // 불꽃 동안은 쏜 각도로 그림. 돌고 바로 쏘면 돌아간 각도는 다음 state로 늦게 옴
      return { x: s.x, y: s.y, facing: flashing ? shot.angle : s.angle, frames: isDown(id, t) ? fallen : flashing ? firing : scarecrow }
    })
}

// 포인터 잠금 중에만 돌림. 잠금 전에는 커서가 화면 밖으로 나가 이동량이 끊김
canvas.addEventListener('click', () => canvas.requestPointerLock())
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || inputLocked(e.timeStamp)) return
  angle = turn(angle, e.movementX, SENSITIVITY)
  pitch = tilt(pitch, e.movementY, SENSITIVITY)
})

const ammo = document.querySelector<HTMLOutputElement>('#ammo')!
let gun = loaded(ROUNDS)
const showAmmo = () => (ammo.value = '●'.repeat(gun.rounds) + '○'.repeat(ROUNDS - gun.rounds))
showAmmo()

const flash = document.querySelector<HTMLDivElement>('#flash')!
const crosshair = document.querySelector<HTMLDivElement>('#crosshair')!

// ponytail: 임시 쏘기 키(왼쪽 클릭). 시스템 기획서 조작의 쏘기 키가 정해지면 바꿈.
// 잠금 전 클릭은 잠금만 걸고 쏘지 않음. "시작!" 전, 쓰러진 뒤, 판 결과가 정해진 뒤의 발사는 서버가 버리므로 탄 수도 줄이지 않음
canvas.addEventListener('mousedown', (e) => {
  if (!grid || !clock || result || document.pointerLockElement !== canvas || e.button !== 0) return
  if (inputLocked(e.timeStamp) || !dueling(schedule, toServerTime(e.timeStamp, clock.offset))) return
  const next = pull(gun, e.timeStamp, FIRE_INTERVAL)
  if (!next) return
  gun = next
  // 불꽃, 탄 수, 총소리는 바로 내고, 명중과 쓰러짐은 서버가 정해 알려 줌
  showAmmo()
  if (audio) playShot(audio, audio.currentTime)
  // 총알은 시선이 아니라 흔들린 총이 가리키는 쪽으로 감. 조준점도 같은 식으로 그려 둘이 맞음
  const aim = aimAt(angle, pitch, e.timeStamp)
  send(fireMessage(aim.angle, aim.pitch, e.timeStamp, clock.offset))
})

function frame(now: number) {
  if (grid && placed) {
    // 내 자리도 다른 사람처럼 INTERP_DELAY 전을 그림. 받은 그대로 그리면 걷는 동안 20Hz로 끊겨 보임
    const view = myView(now)
    renderFrame(pixels, W, H, grid, makeCamera(view.x, view.y, view.angle, FOV, pitch), othersAt(now - INTERP_DELAY))
    ctx.putImageData(image, 0, 0)
    // 마우스 이벤트가 아니라 여기서 보내야 마지막으로 멈춘 각도도 빠지지 않고 감
    if (angle !== sentAngle && now - sentAt >= TURN_INTERVAL && ws.readyState === WebSocket.OPEN) {
      send({ type: 'turn', angle })
      sentAngle = angle
      sentAt = now
    }
  }
  flash.hidden = now - gun.lastShot >= FLASH_SHOWN
  // 내부 px를 cqw로 바꿈. 화면 폭 100cqw가 내부 폭 W px임
  const aim = crosshairOffset(sway(now), pitch, PROJ)
  crosshair.style.transform = `translate(${(aim.x * 100) / W}cqw, ${(aim.y * 100) / W}cqw)`
  if (result?.end !== undefined && clock && toServerTime(now, clock.offset) >= result.end) {
    endResult(result)
    result = null
  }
  // 내가 쓰러진 것과 판 결과도 INTERP_DELAY 뒤에 알림. 나를 맞힌 사람의 불꽃보다 먼저 뜨지 않게 함
  const text =
    result && now - INTERP_DELAY >= result.at
      ? resultText(result, myId)
      : myId !== null && isDown(myId, now - INTERP_DELAY)
        ? '쓰러짐'
        : clock
          ? banner(schedule, toServerTime(now, clock.offset))
          : ''
  if (bannerText.value !== text) bannerText.value = text
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

const lobby = document.querySelector<HTMLFormElement>('#lobby')!
const controls = lobby.querySelector('fieldset')!
const codeInput = document.querySelector<HTMLInputElement>('#code')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const room = document.querySelector<HTMLOutputElement>('#room')!
const readyBar = document.querySelector<HTMLDivElement>('#ready-bar')!
const readyButton = document.querySelector<HTMLButtonElement>('#ready')!
const readyCount = document.querySelector<HTMLOutputElement>('#ready-count')!
const bannerText = document.querySelector<HTMLOutputElement>('#banner')!
let ready = false
// 준비 버튼을 처음 누를 때 만듦. 브라우저는 사용자 입력 전에 만든 AudioContext의 소리를 막음 (기술 설계서 사운드 구현)
let audio: AudioContext | null = null
const REASONS = { notFound: '없는 방 코드', full: '꽉 찬 방', playing: '판이 진행 중인 방' }

// 같은 출처의 /ws. 개발 중에는 vite가 로컬 서버로 넘김 (vite.config.ts)
const ws = new WebSocket('/ws')
// 개발 빌드에서만 주소의 ?lag=N(ms)만큼 왕복을 늘림. 보내기와 받기를 반씩 늦춰 지연이 다른 창끼리 판정을 확인함 (기술 설계서 개발 마일스톤 5).
// 늦추는 시간이 모두 같아 메시지 순서는 그대로임
const LAG = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('lag')) : 0
const later = (f: () => void) => (LAG > 0 ? setTimeout(f, LAG / 2) : f())
const send = (m: ClientMessage) => later(() => ws.send(JSON.stringify(m)))

// 서버 시계와 내 시계의 차이. 맞추기 전에는 null. 서버가 알린 시각을 내 시계로 바꿀 때 씀
let clock: ClockSample | null = null
let syncs: ClockSample[] = []
// 이번 판에 서버가 알린 단계별 시각(서버 시계)
let schedule: Schedule = {}
// 시계를 맞추기 전에는 판 시각을 내 시계로 바꿀 수 없어 막지 않음. 그래도 서버가 걷는 동안의 turn은 버림.
// 쓰러지면 탈락을 받는 즉시 막음. 쓰러졌다는 알림은 늦게 띄워도 그 뒤 입력은 서버가 버리기 때문임
const inputLocked = (now: number) =>
  (myId !== null && downAt.has(myId)) || (clock !== null && locked(schedule, toServerTime(now, clock.offset)))
// 결과 시간이 끝나면 부름. 승리면 준비 중으로 돌아가 처음처럼, 재대결이면 재대결하는 사람만 일으키고 다시 장전함
function endResult(r: RoundResult) {
  if (r.outcome === 'win') {
    schedule = {}
    pitch = 0
    downAt.clear()
    gun = loaded(ROUNDS)
    readyBar.hidden = false
  } else {
    for (const id of r.playerIds) downAt.delete(id)
    if (myId !== null && r.playerIds.includes(myId)) gun = loaded(r.rounds)
  }
  showAmmo()
}
// 접속할 때와 판 사이에 부름. 한 번에 하나씩 보내 앞의 답이 뒤의 왕복을 늘리지 않게 하고, 답이 오면 다음 것을 보냄
function syncClock() {
  syncs = []
  send({ type: 'clockSync', t0: performance.now() })
}

ws.addEventListener('open', () => {
  controls.disabled = false
  status.textContent = ''
  syncClock()
})
// 처음부터 못 붙어도 여기로 옴. ponytail: 재접속 없음. 재접속 이슈에서 다시 붙어 방으로 돌아가게 함
ws.addEventListener('close', () => {
  document.exitPointerLock()
  controls.disabled = true
  lobby.hidden = false
  readyBar.hidden = true
  room.value = ''
  status.textContent = '서버와 연결되지 않음. 새로고침해 다시 접속'
})
ws.addEventListener('message', (e) => later(() => receive(e.data)))
function receive(data: string) {
  const m = parseServerMessage(data)
  switch (m?.type) {
    case 'roomCreated':
    case 'joined':
      lobby.hidden = true
      readyBar.hidden = false
      room.value = `방 ${m.code}`
      myId = m.playerId
      placed = false
      schedule = {}
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
    case 'serverTime':
      syncs.push(measure(m.t0, m.ts, performance.now()))
      if (syncs.length < SYNC_COUNT) {
        send({ type: 'clockSync', t0: performance.now() })
        break
      }
      clock = best(syncs)
      // 잰 지연을 개발자 도구에서 보게 남김. 판정이 이상할 때 먼저 볼 값임
      console.info(`시계 맞춤: 왕복 ${clock.roundTrip.toFixed(1)}ms, 차이 ${clock.offset.toFixed(1)}ms`)
      break
    case 'phase':
      if (result && result.end === undefined) result.end = m.at
      // 새 판은 카운트다운부터 다시 받음. 판 도중의 ready는 서버가 버리므로 준비 버튼을 숨김 (기술 설계서 메시지 ready)
      if (m.phase === 'countdown') {
        schedule = {}
        readyBar.hidden = true
      }
      schedule[m.phase] = m.at
      // 신호음은 프레임을 기다리지 않고 AudioContext 시계로 결투 시각에 맞춰 예약함 (기술 설계서 시간 맞추기)
      if (m.phase === 'duel' && audio && clock) playSignal(audio, toAudioTime(toLocalTime(m.at, clock.offset), stampOf(audio)))
      break
    case 'shot':
      // 내 불꽃과 총소리는 쏠 때 이미 냄
      if (m.playerId !== myId) showShot(m.playerId, m.angle)
      break
    case 'eliminated':
      downAt.set(m.playerId, performance.now())
      break
    case 'result':
      // 창이 숨어 그리기가 멈춘 동안에는 앞 결과가 끝나지 않은 채 다음 결과가 올 수 있어 먼저 끝냄
      if (result) endResult(result)
      result = { ...m, at: performance.now() }
      break
  }
}

document.querySelector('#create')!.addEventListener('click', () => send({ type: 'createRoom' }))
// ponytail: 포인터 잠금 중에는 Esc로 커서를 풀어야 누를 수 있음. 조작이 정해지면 키로도 누르게 함
readyButton.addEventListener('click', () => {
  audio ??= new AudioContext()
  // 판 사이에 시계를 다시 잼. 판이 시작되기 직전이라 이번 판 시각을 바꾸는 데 가장 새 값이 됨
  if (!ready) syncClock()
  send({ type: 'ready', ready: !ready })
})
lobby.addEventListener('submit', (e) => {
  e.preventDefault()
  send({ type: 'joinRoom', code: codeInput.value })
})
