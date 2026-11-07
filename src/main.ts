import './style.css'
import revolverData from './assets/revolver-rig.json'
import { orbit } from './backdrop.ts'
import { characterFrames, suicideStage, type Poses } from './character.ts'
import { best, measure, toLocalTime, toServerTime, type ClockSample } from './clock.ts'
import { makeProps, SKIES, timeOfDay } from './desert.ts'
import { drawGun, gunClips, lift, RAISE_MS, RECOIL_MS, RELOAD_AT, RELOAD_SEATED, RELOAD_SHUT, revolverMesh } from './gun.ts'
import { dotPosition, noBlood, onGameEnd, onRevived, onWalk, onWounded, resultLabel } from './hitcard.ts'
import { record, sampleAt, type Sample } from './interpolate.ts'
import { fireMessage, parseServerMessage, stopMessage, type ClientMessage, type PlayerState, type RoundResult, type ShotResult } from './net.ts'
import { normalizeNickname } from './nickname.ts'
import { BANDANA, joinable, memberText, roomStatus, type RoomInfo } from './roomlist.ts'
import { normalizeRoomName, randomRoomName } from './roomname.ts'
import type { Grid } from './raycast.ts'
import { makeCamera, renderFrame } from './render.ts'
import { loaded, pull, ROUNDS } from './revolver.ts'
import type { Rig } from './rig.ts'
import { banner, dueling, formatTime, joins, locked, resultText, stepIndex, timeLeft, walking, type Schedule } from './round.ts'
import { heardFrom, loadEffects, play, playSignal, playStep, stampOf, toAudioTime } from './sound.ts'
import type { Sprite, Thing } from './sprite.ts'
import { afterTurn, aimAt, crosshairOffset, scaleAt, steady, sway } from './sway.ts'
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
// 결투장 둘레의 선인장, 바위, 회전초. 맵을 받을 때 그 중심에 맞춰 놓음
let props: Thing[] = []
// 그 라운드에 선 사람 수. 카운트다운이 시작할 때 정해 판 도중에 쓰러져도 하늘 시간대가 바뀌지 않음. 판 사이에는 null이고 방 인원을 씀
let standing: number | null = null
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
// 사람마다 목수건 색 번호. state마다 새로 받음
let colors = new Map<string, number>()
// 1인칭 리볼버 모델. 부품이 뼈대로 움직임 (컨셉 기획서 아트와 사운드 1인칭 총)
const revolver = revolverData as Rig
// 이번 카운트다운에 내가 끼어 장전하는지. 카운트다운을 받을 때 장전 소리와 같은 조건으로 정함
let reloading = false
// 다른 사람이 마지막으로 쏜 것과 쓰러진 것을 받은 시각(ms). state처럼 INTERP_DELAY 뒤에 보여 줘 돌기, 발사, 쓰러짐의 순서를 지킴.
// ponytail: 사람마다 마지막 발사 하나만 둠. 발사 간격(250ms)이 불꽃(100ms)보다 길어 겹치지 않음. 지연이 크게 흔들려 둘이 붙어 오면 앞 불꽃이 빠짐
const shots = new Map<string, { at: number; angle: number }>()
// 쓰러진 사람마다 탈락을 받은 시각(ms)과 사유. 시간 초과면 쓰러진 그림 전에 자살 모습을 보여 줌
const downs = new Map<string, { at: number; reason: 'shot' | 'timeout' }>()
const isDown = (id: string, t: number) => (downs.get(id)?.at ?? Infinity) <= t
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
  colors = new Map(players.map((p) => [p.id, p.color]))
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
  play(audio, 'shot', toAudioTime(now + INTERP_DELAY, stampOf(audio)), heardFrom(view.x, view.y, view.angle, shooter.x, shooter.y))
}

function othersAt(t: number): Thing[] {
  const duel = clock !== null && dueling(schedule, toServerTime(t, clock.offset))
  // 걷는 사람은 발소리를 내는 걸음마다 다리를 바꿈. 걷기 시각 조금 전이면 -1이라 & 1로 묶음
  const step = clock !== null && schedule.walk !== undefined ? stepIndex(schedule.walk, toServerTime(t, clock.offset)) & 1 : 0
  return [...history]
    .filter(([id]) => id !== myId)
    .map(([id, samples]) => {
      const s = sampleAt(samples, t)
      const shot = shots.get(id)
      const flashing = shot !== undefined && t >= shot.at && t < shot.at + FLASH_SHOWN
      const poses = characterFrames(colors.get(id)!)
      // "시작!"부터 서 있는 사람은 총을 겨눈 그림
      const upright = duel ? poses.aim : s.pose === 'walk' ? poses.walk[step] : poses.stand
      // 불꽃 동안은 쏜 각도로 그림. 돌고 바로 쏘면 돌아간 각도는 다음 state로 늦게 옴
      return { x: s.x, y: s.y, facing: flashing ? shot.angle : s.angle, frames: flashing ? poses.fire : poseFrames(poses, id, t, upright) }
    })
}

function poseFrames(poses: Poses, id: string, t: number, upright: Sprite[]) {
  const down = downs.get(id)
  if (down === undefined || t < down.at) return upright
  const stage = down.reason === 'timeout' ? suicideStage(t - down.at) : null
  return stage === null ? poses.fallen : poses.suicide[stage]
}

// 포인터 잠금 중에만 돌림. 잠금 전에는 커서가 화면 밖으로 나가 이동량이 끊김
canvas.addEventListener('click', () => canvas.requestPointerLock())
// 팔 흔들림 배율. 돈 만큼 커지고 가만히 있으면 잦아듦. 빨리 돌아 바로 쏘면 부정확함 (시스템 기획서 리볼버 흔들림 배율)
let unsteady = steady
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || inputLocked(e.timeStamp)) return
  angle = turn(angle, e.movementX, SENSITIVITY)
  pitch = tilt(pitch, e.movementY, SENSITIVITY)
  unsteady = afterTurn(unsteady, Math.hypot(e.movementX, e.movementY) * SENSITIVITY, e.timeStamp)
})

const ammo = document.querySelector<SVGSVGElement>('#ammo')!
const chambers = ammo.querySelectorAll('.chamber')
let gun = loaded(ROUNDS)
// 6칸 실린더에서 장전된 칸만 금색. 위 칸부터 채움 (시스템 기획서 HUD 탄 수)
function showAmmo() {
  chambers.forEach((c, i) => c.classList.toggle('loaded', i < gun.rounds))
  ammo.setAttribute('aria-label', `남은 총알 ${gun.rounds}발`)
}
showAmmo()

const flash = document.querySelector<HTMLDivElement>('#flash')!
const crosshair = document.querySelector<HTMLDivElement>('#crosshair')!
const hitCard = document.querySelector<HTMLElement>('#hit-card')!
const hitHole = document.querySelector<SVGCircleElement>('#hit-hole')!
const hitStamp = document.querySelector<HTMLOutputElement>('#hit-stamp')!
const bloodView = document.querySelector<HTMLDivElement>('#blood')!
// 반샷 혈흔. 판이 끝날 때까지 남아 한 발만 더 맞으면 쓰러진다는 표시를 겸함 (컨셉 기획서 화면 혈흔)
let blood = noBlood

// 서버 판정이 확정된 결과라 받은 때부터 띄우고 그 라운드 결과 시간이 끝날 때(endResult) 닫음. 빗나가면 구멍 없이 도장만 (컨셉 기획서 화면 내 사격 결과)
function showHitCard(r: ShotResult) {
  hitCard.hidden = false
  hitStamp.value = resultLabel(r)
  hitHole.style.visibility = r.zone === null ? 'hidden' : 'visible'
  if (r.zone === null) return
  const dot = dotPosition(r.offset, r.height)
  hitHole.setAttribute('cx', String(dot.x))
  hitHole.setAttribute('cy', String(dot.y))
}

// 이번 라운드에 내가 걷다 멈춘 시각(ms, 내 시계). 안 멈췄으면 null. 한 라운드에 한 번만 멈추고, 멈춘 뒤로는 내 발소리를 내지 않음
let stoppedAt: number | null = null
// 사람마다 마지막으로 발소리를 낸 걸음 번호. 걷기 시각을 받을 때 비움
const lastStep = new Map<string, number>()

// 걷는 동안 왼쪽 클릭은 멈추기 (시스템 기획서 조작). 도는 것과 상관없어 포인터 잠금이 없어도 받음. 그래야 잠그는 첫 클릭으로도 멈춤
canvas.addEventListener('mousedown', (e) => {
  if (!clock || e.button !== 0 || stoppedAt !== null || myId === null || downs.has(myId)) return
  if (!walking(schedule, toServerTime(e.timeStamp, clock.offset))) return
  stoppedAt = e.timeStamp
  send(stopMessage(e.timeStamp, clock.offset))
})

// 걷는 사람마다 걸음 번호가 늘면 그 사람 쪽에서 발소리를 냄. 그래서 누가 멈췄는지 귀로 앎 (컨셉 기획서 아트와 사운드 효과음).
// 다른 사람은 그림처럼 INTERP_DELAY 전의 동작으로 가르고, 나는 서버 동작을 기다리지 않고 내가 멈춘 시각으로 가름
function playSteps(now: number) {
  if (!audio || !clock || schedule.walk === undefined) return
  const t = now - INTERP_DELAY
  const serverT = toServerTime(t, clock.offset)
  if (!walking(schedule, serverT)) return
  const step = stepIndex(schedule.walk, serverT)
  const view = myView(now)
  for (const [id, samples] of history) {
    const s = sampleAt(samples, t)
    // 다음 라운드에 끼지 못해 쓰러진 채인 나는 걷지 않음
    const going = id === myId ? !downs.has(id) && (stoppedAt === null || t < stoppedAt) : s.pose === 'walk'
    if (!going || step <= (lastStep.get(id) ?? -1)) continue
    lastStep.set(id, step)
    playStep(audio, audio.currentTime, id === myId ? undefined : heardFrom(view.x, view.y, view.angle, s.x, s.y))
  }
}

// ponytail: 임시 쏘기 키(왼쪽 클릭). 시스템 기획서 조작의 쏘기 키가 정해지면 바꿈.
// 잠금 전 클릭은 잠금만 걸고 쏘지 않음. "시작!" 전, 쓰러진 뒤, 판 결과가 정해진 뒤의 발사는 서버가 버리므로 탄 수도 줄이지 않음
canvas.addEventListener('mousedown', (e) => {
  if (!grid || !clock || result || document.pointerLockElement !== canvas || e.button !== 0) return
  if (inputLocked(e.timeStamp) || !dueling(schedule, toServerTime(e.timeStamp, clock.offset))) return
  const next = pull(gun, e.timeStamp, FIRE_INTERVAL)
  if (!next) {
    // 빈 총은 서버에 알리지 않아 내 화면에서만 들림. 남이 들으면 누가 이미 쐈는지 알게 됨 (시스템 기획서 사운드)
    if (audio && gun.rounds <= 0) play(audio, 'dryFire', audio.currentTime)
    return
  }
  gun = next
  // 불꽃, 탄 수, 총소리는 바로 내고, 명중과 쓰러짐은 서버가 정해 알려 줌
  showAmmo()
  if (audio) play(audio, 'shot', audio.currentTime)
  // 총알은 시선이 아니라 흔들린 총이 가리키는 쪽으로 감. 조준점도 같은 식으로 그려 둘이 맞음
  const aim = aimAt(angle, pitch, e.timeStamp, scaleAt(unsteady, e.timeStamp))
  send(fireMessage(aim.angle, aim.pitch, e.timeStamp, clock.offset))
})

function frame(now: number) {
  const s = sway(now, scaleAt(unsteady, now))
  if (grid && placed) {
    // 내 자리도 다른 사람처럼 INTERP_DELAY 전을 그림. 받은 그대로 그리면 걷는 동안 20Hz로 끊겨 보임
    const view = myView(now)
    const things = [...othersAt(now - INTERP_DELAY), ...props]
    renderFrame(pixels, W, H, grid, makeCamera(view.x, view.y, view.angle, FOV, pitch), things, SKIES[timeOfDay(standing ?? history.size)])
    ctx.putImageData(image, 0, 0)
    playSteps(now)
    // 총은 시점에 붙어 있어 위아래 시선과 상관없이 같은 자리에 있고, 조준점과 같은 흔들림으로 돎.
    // ponytail: 총에는 시간대 빛 색조를 곱하지 않음. 석양에 총만 밝아 보여 거슬리면 drawGun에 빛 색조를 넘겨 면 색에 곱함
    // 들어 올리기는 보이기만 함. 조준점과 발사는 총을 다 들기 전에도 그대로임
    // 부품 움직임도 서버 시계로 재어 AudioContext로 예약한 장전·공이치기 소리와 맞음
    const hold = clock ? lift(schedule, toServerTime(now, clock.offset), reloading) : { lower: 1, kick: 0 }
    const plays = clock ? gunClips(schedule, toServerTime(now, clock.offset), reloading, toServerTime(gun.lastShot, clock.offset)) : []
    const kick = Math.max(hold.kick, 1 - (now - gun.lastShot) / RECOIL_MS)
    const muzzle = drawGun(ctx, revolverMesh(revolver, plays, gun.rounds), { ...s, kick, lower: hold.lower }, W, H, PROJ)
    flash.style.transform = `translate(${(muzzle.x * 100) / W}cqw, ${(muzzle.y * 100) / W}cqw)`
    // 마우스 이벤트가 아니라 여기서 보내야 마지막으로 멈춘 각도도 빠지지 않고 감
    if (angle !== sentAngle && now - sentAt >= TURN_INTERVAL && ws.readyState === WebSocket.OPEN) {
      send({ type: 'turn', angle })
      sentAngle = angle
      sentAt = now
    }
  } else if (!lobby.hidden) {
    // 첫 화면 뒤로 석양 속에 마주 선 두 총잡이 둘레를 천천히 돎 (시스템 기획서 방 화면 M8 첫 화면)
    const cam = orbit(BACKDROP_MID, BACKDROP_MID, BACKDROP_RADIUS, (now - BACKDROP_T0) * BACKDROP_TURN)
    renderFrame(pixels, W, H, BACKDROP, makeCamera(cam.x, cam.y, cam.angle, FOV, BACKDROP_PITCH), BACKDROP_THINGS, SKIES.sunset)
    ctx.putImageData(image, 0, 0)
  }
  flash.hidden = now - gun.lastShot >= FLASH_SHOWN
  bloodView.hidden = !blood.shown
  // 내부 px를 cqw로 바꿈. 화면 폭 100cqw가 내부 폭 W px임
  const aim = crosshairOffset(s, pitch, PROJ)
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
  // 결투 중에만 보임. 결과를 받으면 숨김 (시스템 기획서 HUD 남은 시간)
  const left = clock && !result ? timeLeft(schedule, toServerTime(now, clock.offset)) : null
  timer.hidden = left === null
  const clockText = left === null ? '' : formatTime(left)
  if (timer.value !== clockText) timer.value = clockText
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

const lobby = document.querySelector<HTMLFormElement>('#lobby')!
const nameStep = document.querySelector<HTMLFieldSetElement>('#name-step')!
const roomStep = document.querySelector<HTMLFieldSetElement>('#room-step')!
const whoName = document.querySelector<HTMLElement>('#who-name')!
const roomList = document.querySelector<HTMLUListElement>('#room-list')!
const nameOk = document.querySelector<HTMLButtonElement>('#name-ok')!
const codeInput = document.querySelector<HTMLInputElement>('#code')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const room = document.querySelector<HTMLOutputElement>('#room')!
const readyBar = document.querySelector<HTMLDivElement>('#ready-bar')!
const readyButton = document.querySelector<HTMLButtonElement>('#ready')!
const readyCount = document.querySelector<HTMLOutputElement>('#ready-count')!
const bannerText = document.querySelector<HTMLOutputElement>('#banner')!
const timer = document.querySelector<HTMLOutputElement>('#timer')!
let ready = false
// 준비 버튼을 처음 누를 때 만들고 효과음도 이때 받기 시작함. 브라우저는 사용자 입력 전에 만든 AudioContext의 소리를 막음 (기술 설계서 사운드 구현)
let audio: AudioContext | null = null
const REASONS = {
  notFound: '없는 방 코드',
  full: '꽉 찬 방',
  playing: '판이 진행 중인 방',
  nickname: '닉네임 규칙에 맞지 않음',
  roomName: '방 이름 규칙에 맞지 않음',
  maxPlayers: '인원은 2~8명',
}
const nicknameInput = document.querySelector<HTMLInputElement>('#nickname')!
const nicknameRule = document.querySelector<HTMLParagraphElement>('#nickname-rule')!
const privateBox = document.querySelector<HTMLInputElement>('#private')!
// 방에 들어가기 전에는 서버 맵이 없어, 첫 화면 배경은 서버 ArenaMap과 같은 21칸 둘레 벽 결투장을 그림
const BACKDROP: Grid = Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => (x % 20 === 0 || y % 20 === 0 ? 1 : 0)))
// 라디안/ms. 한 바퀴에 약 1분. ponytail: 임시 값
const BACKDROP_TURN = 0.0001
const BACKDROP_MID = BACKDROP.length / 2
// 칸. 첫 화면에서 마주 선 두 총잡이 사이 거리. ponytail: 임시 값
const DUEL_GAP = 3
// 칸. 카메라가 두 사람 가운데를 도는 반지름. 소품(가운데에서 5칸 넘게 떨어짐)보다 안쪽이라 소품이 두 사람을 가리지 않고,
// 옆에서 볼 때 두 사람이 화면 양쪽으로 벌어져 가운데 방 목록에 가리지 않음. ponytail: 임시 값
const BACKDROP_RADIUS = 4
// 라디안. 조금 올려 봐 두 사람이 제목 아래로 내려오고 석양 하늘이 넓게 보임. ponytail: 임시 값
const BACKDROP_PITCH = 0.1
// 첫 화면 배경에 세우는 것. 남북으로 마주 보고 총을 찬 채 선 두 사람(목수건 빨강, 하늘색)과 둘레 소품. 그림은 여기서 한 번만 만듦
const BACKDROP_THINGS: Thing[] = [
  { x: BACKDROP_MID, y: BACKDROP_MID - DUEL_GAP / 2, facing: Math.PI / 2, frames: characterFrames(0).stand },
  { x: BACKDROP_MID, y: BACKDROP_MID + DUEL_GAP / 2, facing: -Math.PI / 2, frames: characterFrames(1).stand },
  ...makeProps(BACKDROP_MID, BACKDROP_MID),
]
// 배경이 돌기 시작한 시각(ms). 페이지가 뜨는 데 걸린 시간만큼 돌아가 있지 않고 늘 같은 장면에서 시작함.
// 방위 0은 동쪽에서 서쪽을 봐 두 사람이 옆모습으로 마주 서고 지는 해가 오른쪽 사람 어깨 뒤에 걸림
const BACKDROP_T0 = performance.now()
// 브라우저에 기억해 다음에는 다시 넣지 않음. 사생활 보호 모드처럼 저장소를 막으면 던지므로 기억 못 해도 그냥 둠
const SAVED_NICKNAME = 'nickname'
try {
  nicknameInput.value = localStorage.getItem(SAVED_NICKNAME) ?? ''
} catch {}
// 정한 닉네임. 정하기 전(1단계)에는 null. 기억한 이름이 맞으면 바로 방 목록 단계로 감
let nickname = normalizeNickname(nicknameInput.value)
let connected = false
// ms. 방 목록이 보이는 동안 다시 받는 간격. ponytail: 임시 값(시스템 기획서 방 화면 대기실 보기)
const ROOMS_EVERY = 2000
let roomsTimer = 0

// 맞는 이름이면 그 이름, 틀리면 null. 넣은 이름이 틀리면 규칙을 빨갛게 보이고 확인 버튼을 막음
function checkNickname(): string | null {
  const name = normalizeNickname(nicknameInput.value)
  nicknameRule.classList.toggle('bad', name === null && nicknameInput.value !== '')
  nameOk.disabled = name === null
  return name
}
checkNickname()
nicknameInput.addEventListener('input', checkNickname)

// 첫 화면의 단계를 맞춤. 닉네임을 정했으면 방 목록 단계이고, 그 단계가 보이는 동안만 방 목록을 다시 받음
function showStep() {
  const naming = nickname === null
  nameStep.hidden = !naming
  roomStep.hidden = naming
  nameStep.disabled = !connected || !naming
  roomStep.disabled = !connected || naming
  whoName.textContent = nickname ?? ''
  clearInterval(roomsTimer)
  if (naming || !connected || lobby.hidden) return
  send({ type: 'listRooms' })
  roomsTimer = setInterval(() => send({ type: 'listRooms' }), ROOMS_EVERY)
}
showStep()

document.querySelector('#rename')!.addEventListener('click', () => {
  nickname = null
  showStep()
  nicknameInput.focus()
})

// 방 목록 (시스템 기획서 방 화면 대기실 보기). 사용자가 넣은 이름이라 textContent로만 넣음
function showRooms(rooms: readonly RoomInfo[]) {
  const items = rooms.map((r) => {
    const li = document.createElement('li')
    li.classList.toggle('closed', !joinable(r))
    const name = document.createElement('strong')
    name.textContent = r.name
    const who = document.createElement('span')
    for (const p of r.players.slice(0, 3)) {
      const dot = document.createElement('i')
      dot.className = 'dot'
      dot.style.background = BANDANA[p.color]
      who.append(dot)
    }
    who.append(memberText(r.players))
    const count = document.createElement('span')
    count.textContent = `${r.players.length}/${r.max}`
    const state = document.createElement('span')
    state.textContent = roomStatus(r)
    li.append(name, who, count, state)
    if (joinable(r)) {
      const join = document.createElement('button')
      join.type = 'button'
      join.className = 'plank'
      join.textContent = '입장'
      join.addEventListener('click', () => enterWith((nickname) => ({ type: 'joinRoom', code: r.code, nickname })))
      li.append(join)
    }
    return li
  })
  if (items.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty'
    // ponytail: 임시 문구
    empty.textContent = '열린 방이 없음'
    items.push(empty)
  }
  roomList.replaceChildren(...items)
}

// 방에 들어가는 버튼마다 부름. 정한 닉네임으로 메시지를 만들어 보냄
function enterWith(message: (nickname: string) => ClientMessage) {
  if (nickname === null) return
  status.textContent = ''
  send(message(nickname))
}

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
  (myId !== null && downs.has(myId)) || (clock !== null && locked(schedule, toServerTime(now, clock.offset)))
// 결과 시간이 끝나면 부름. 승리면 준비 중으로 돌아가 처음처럼, 재대결이면 재대결하는 사람만 일으키고 다시 장전함
function endResult(r: RoundResult) {
  hitCard.hidden = true
  if (r.outcome === 'win') {
    schedule = {}
    standing = null
    pitch = 0
    downs.clear()
    gun = loaded(ROUNDS)
    blood = onGameEnd()
    readyBar.hidden = false
  } else {
    // 쓰러졌다 다시 서는 나(함께 쓰러짐)는 혈흔을 그 라운드 전으로 되돌림. 서버가 반샷을 되돌리는 것과 같음. 일으키기 전에 봐야 가를 수 있음
    if (myId !== null && downs.has(myId) && r.playerIds.includes(myId)) blood = onRevived(blood)
    for (const id of r.playerIds) downs.delete(id)
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
  connected = true
  showStep()
  status.textContent = ''
  syncClock()
})
// 처음부터 못 붙어도 여기로 옴. ponytail: 재접속 없음. 재접속 이슈에서 다시 붙어 방으로 돌아가게 함
ws.addEventListener('close', () => {
  document.exitPointerLock()
  connected = false
  createPanel.hidden = true
  lobby.hidden = false
  showStep()
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
      showStep()
      readyBar.hidden = false
      // ponytail: 술집 칠판이 생기기 전까지 오른쪽 위 방 코드 옆에 방 이름과 비공개를 적음 (M8 C5에서 옮김)
      room.value = `${m.name} · ${m.code}${m.private ? ' · 비공개' : ''}`
      myId = m.playerId
      placed = false
      schedule = {}
      standing = null
      break
    case 'error':
      status.textContent = REASONS[m.reason]
      break
    // 방에 다시 들어와도 맵이 다시 옴 (기술 설계서 메시지)
    case 'map':
      grid = m.cells
      props = makeProps(m.cells[0].length / 2, m.cells.length / 2)
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
        // 재대결이면 재대결하는 사람만, 새 판이면 방 사람 모두가 섬. 앞 판 결과는 이 시각에 끝나므로 아직 남아 있음
        standing = result?.outcome === 'rematch' ? result.playerIds.length : history.size
        reloading = myId !== null && joins(result, myId)
      }
      if (m.phase === 'walk') {
        // 걷기 시각은 다음 라운드 카운트다운이 시작한 뒤에 와 결과 시간은 이미 끝났음. 창이 숨어 그리기가 멈췄으면 결과를 여기서 먼저 끝내야
        // 혈흔을 되돌린 뒤에 이번 라운드 시작 값으로 기억함
        if (result?.end !== undefined) {
          endResult(result)
          result = null
        }
        blood = onWalk(blood)
        stoppedAt = null
        lastStep.clear()
      }
      schedule[m.phase] = m.at
      // 신호음, 장전, 공이치기는 프레임을 기다리지 않고 AudioContext 시계로 그 단계 시각에 맞춰 예약함 (기술 설계서 시간 맞추기).
      // 장전과 공이치기는 내 것만 들음. 장전은 이번 라운드에 끼는 나만, 공이치기는 "시작!"에 서서 총을 드는 나만
      if (audio && clock && myId !== null) {
        const when = toAudioTime(toLocalTime(m.at, clock.offset), stampOf(audio))
        // 장전 소리는 Reload 클립에서 총알이 다 들어갈 때, 실린더 닫는 소리는 실린더가 다 닫힐 때 딸깍이 들리게 함 (gun.ts gunClips)
        if (m.phase === 'countdown' && reloading) {
          play(audio, 'load', when + RELOAD_AT / 1000 + RELOAD_SEATED)
          play(audio, 'closeCylinder', when + RELOAD_AT / 1000 + RELOAD_SHUT)
        }
        if (m.phase === 'duel') {
          playSignal(audio, when)
          // 공이치기는 총을 다 들어 공이치기가 끝까지 젖혀지고 화면이 튀는 순간에 맞춤 (gun.ts lift, gunClips).
          // ponytail: 총을 다 드는 RAISE_MS(0.2초) 안에 쏘면 공이치기 소리와 튐이 총소리 뒤에 남. 거슬리면 쏠 때 예약한 공이치기를 멈춤(AudioBufferSourceNode.stop)
          if (!downs.has(myId)) play(audio, 'cockHammer', when + RAISE_MS / 1000)
        }
      }
      break
    case 'shot':
      // 내 불꽃과 총소리는 쏠 때 이미 냄
      if (m.playerId !== myId) showShot(m.playerId, m.angle)
      break
    case 'eliminated':
      downs.set(m.playerId, { at: performance.now(), reason: m.reason })
      break
    case 'result':
      // 창이 숨어 그리기가 멈춘 동안에는 앞 결과가 끝나지 않은 채 다음 결과가 올 수 있어 먼저 끝냄
      if (result) endResult(result)
      result = { ...m, at: performance.now() }
      break
    case 'shotResult':
      showHitCard(m)
      break
    case 'wounded':
      blood = onWounded(blood)
      break
    case 'rooms':
      if (!roomStep.hidden) showRooms(m.rooms)
      break
  }
}

document.querySelector('#quick')!.addEventListener('click', () => enterWith((nickname) => ({ type: 'quickJoin', nickname })))
// 방 만들기 창 (시스템 기획서 방 화면 방 만들기 창). 열 때마다 무작위 이름, 8명, 공개로 채움
const createPanel = document.querySelector<HTMLDivElement>('#create-panel')!
const roomNameInput = document.querySelector<HTMLInputElement>('#room-name')!
const roomNameRule = document.querySelector<HTMLParagraphElement>('#room-name-rule')!
const maxPlayersSelect = document.querySelector<HTMLSelectElement>('#max-players')!
const createOk = document.querySelector<HTMLButtonElement>('#create-ok')!

// 맞는 이름이면 그 이름, 틀리면 null. 틀리면 규칙을 빨갛게 보이고 생성 버튼을 막음
function checkRoomName(): string | null {
  const name = normalizeRoomName(roomNameInput.value)
  roomNameRule.hidden = name !== null
  createOk.disabled = name === null
  return name
}

function rollRoomName() {
  roomNameInput.value = randomRoomName()
  checkRoomName()
}

document.querySelector('#create')!.addEventListener('click', () => {
  if (nickname === null) return
  rollRoomName()
  maxPlayersSelect.value = '8'
  privateBox.checked = false
  createPanel.hidden = false
  roomNameInput.select()
})
document.querySelector('#dice')!.addEventListener('click', rollRoomName)
roomNameInput.addEventListener('input', checkRoomName)
document.querySelector('#create-cancel')!.addEventListener('click', () => (createPanel.hidden = true))
createPanel.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') createPanel.hidden = true
})
document.querySelector('#create-form')!.addEventListener('submit', (e) => {
  e.preventDefault()
  const name = checkRoomName()
  if (name === null) return
  createPanel.hidden = true
  enterWith((nickname) => ({ type: 'createRoom', nickname, name, maxPlayers: Number(maxPlayersSelect.value), private: privateBox.checked }))
})
// ponytail: 포인터 잠금 중에는 Esc로 커서를 풀어야 누를 수 있음. 조작이 정해지면 키로도 누르게 함
readyButton.addEventListener('click', () => {
  if (!audio) {
    audio = new AudioContext()
    loadEffects(audio)
  }
  // 판 사이에 시계를 다시 잼. 판이 시작되기 직전이라 이번 판 시각을 바꾸는 데 가장 새 값이 됨
  if (!ready) syncClock()
  send({ type: 'ready', ready: !ready })
})
// 1단계에서는 닉네임 확인, 2단계에서는 방 코드로 입장. 숨은 단계의 칸은 꺼져 있어 검사하지 않음
lobby.addEventListener('submit', (e) => {
  e.preventDefault()
  if (nickname === null) {
    const name = checkNickname()
    if (name === null) return
    nickname = name
    try {
      localStorage.setItem(SAVED_NICKNAME, name)
    } catch {}
    showStep()
    return
  }
  enterWith((nickname) => ({ type: 'joinRoom', code: codeInput.value, nickname }))
})
