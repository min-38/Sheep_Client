import closeCylinderUrl from './assets/audio/close-cylinder.mp3'
import cockHammerUrl from './assets/audio/cock-hammer.mp3'
import dryFireUrl from './assets/audio/dry-fire.mp3'
import loadUrl from './assets/audio/load.mp3'
import shotUrl from './assets/audio/shot.mp3'
import { FALL_LAND_MS, SUICIDE_AIM, SUICIDE_FLASH } from './character.ts'
import type { DownReason } from './net.ts'

// AudioContext 시계(초)와 내 시계(ms, performance.now())를 잇는 한 쌍. contextTime에 나간 소리가 스피커에서 들리는 순간이 performanceTime임
export type AudioStamp = { contextTime: number; performanceTime: number }

// 내 시각(ms)에 스피커에서 들리려면 소리를 내보낼 AudioContext 시각(초)
export const toAudioTime = (local: number, s: AudioStamp) => s.contextTime + (local - s.performanceTime) / 1000

// getOutputTimestamp는 출력 지연까지 넣어 두 시계를 이음. 소리가 아직 한 번도 나가지 않았으면 0을 줘서, 그때는 출력 지연 없이 지금 시각으로 이음
export function stampOf(audio: AudioContext): AudioStamp {
  const { contextTime, performanceTime } = audio.getOutputTimestamp()
  if (contextTime && performanceTime) return { contextTime, performanceTime }
  return { contextTime: audio.currentTime, performanceTime: performance.now() }
}

// 모든 효과음이 지나는 크기 조절 하나. 설정의 효과음 크기를 여기에만 걸어 소리마다 고치지 않음.
// 배경음악은 여기를 지나지 않아 음악을 꺼도 총소리는 들림 (컨셉 기획서 화면 설정)
let effectsVolume = 1
let effectsBus: GainNode | null = null

function effectsOut(audio: AudioContext): AudioNode {
  if (effectsBus?.context !== audio) {
    effectsBus = new GainNode(audio, { gain: effectsVolume })
    effectsBus.connect(audio.destination)
  }
  return effectsBus
}

// 효과음 크기(0~1). AudioContext를 만들기 전에 불러도 만들 때 이 값을 씀
export function setEffectsVolume(volume: number) {
  effectsVolume = volume
  if (effectsBus) effectsBus.gain.value = volume
}

// 초. "시작!" 신호음 길이
const SIGNAL_SECONDS = 0.3

// "시작!" 신호음을 when(AudioContext 시각, 초)에 울림. 0.3초 넘게 늦으면 소리가 다 줄어든 뒤라 들리지 않음.
// ponytail: Web Audio로 합성한 임시음. CC0 효과음으로 바꿀 때 이 함수만 고침 (기술 설계서 사운드 구현)
export function playSignal(audio: AudioContext, when: number) {
  const tone = new OscillatorNode(audio, { frequency: 880 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.3, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + SIGNAL_SECONDS)
  tone.connect(volume).connect(effectsOut(audio))
  tone.start(when)
  tone.stop(when + SIGNAL_SECONDS)
}

// 쏜 사람 자리(칸)를 내 시선 기준으로 바꿈. right는 화면 오른쪽(카메라 평면 쪽), front는 시선 쪽 거리(칸)
export function heardFrom(viewX: number, viewY: number, angle: number, x: number, y: number) {
  const dx = x - viewX
  const dy = y - viewY
  return { right: Math.cos(angle) * dy - Math.sin(angle) * dx, front: Math.cos(angle) * dx + Math.sin(angle) * dy }
}

// 효과음 파일 (CREDITS.md). 코드로 불러와 Vite가 이름에 해시를 붙이고, 파일이 없으면 빌드가 깨짐
const files = { shot: shotUrl, load: loadUrl, closeCylinder: closeCylinderUrl, cockHammer: cockHammerUrl, dryFire: dryFireUrl }
type Effect = keyof typeof files
// ponytail: 들어 보지 않고 정한 임시 크기. 플레이해 보며 소리끼리 맞춤 (시스템 기획서 사운드)
const VOLUME: Record<Effect, number> = { shot: 0.5, load: 0.6, closeCylinder: 0.6, cockHammer: 0.6, dryFire: 0.6 }
// 초. 파일 처음부터 가장 큰 딸깍까지. 파일을 풀어 10ms 단위로 잰 값. 이만큼 앞당겨 내보내 딸깍이 총 움직임과 같은 때 들림
const CLICK: Record<Effect, number> = { shot: 0, load: 0.2, closeCylinder: 0.12, cockHammer: 0.1, dryFire: 0 }
// 다 풀어 둔 소리. 아직 받거나 푸는 중인 소리는 없어서 그때 낼 소리는 건너뜀
const buffers: Partial<Record<Effect, AudioBuffer>> = {}

// 효과음을 모두 받아 풀어 둠. AudioContext를 만든 직후 한 번 부름
export function loadEffects(audio: AudioContext) {
  for (const [name, url] of Object.entries(files) as [Effect, string][]) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => audio.decodeAudioData(data))
      .then((buffer) => (buffers[name] = buffer))
  }
}

// 효과음의 딸깍(CLICK)이 when(AudioContext 시각, 초)에 들리게 냄. from이 있으면 그 자리에서 들리고(HRTF), 없으면 내 소리라 가운데서 들림.
// 듣는 사람(AudioListener)은 기본값 그대로 원점에서 -z를 보므로 오른쪽이 +x, 앞이 -z임.
// 4칸(걷기를 마친 자리의 반지름) 안에서는 같은 크기, 더 멀면 거리에 반비례해 줄어듦. gain은 효과음 크기에 더 곱하는 몫. 아직 풀지 못한 소리는 건너뜀
// 낸 소리를 돌려줘, 아직 나지 않았으면 멈추고 다른 때로 다시 낼 수 있음
export function play(audio: AudioContext, name: Effect, when: number, from?: { right: number; front: number }, gain = 1): AudioScheduledSourceNode | undefined {
  const buffer = buffers[name]
  if (!buffer) return
  const source = new AudioBufferSourceNode(audio, { buffer })
  place(audio, source.connect(new GainNode(audio, { gain: VOLUME[name] * gain })), from)
  source.start(when - CLICK[name])
  return source
}

// 발소리 한 걸음을 when(AudioContext 시각, 초)에 냄. 방향과 거리는 총소리와 같음.
// 모래를 밟는 낮은 잡음에 부츠 굽이 땅을 찍는 낮은 쿵을 더해 무겁게 들림 (사용자 결정 2026-11-10, SHEEP-141).
// ponytail: 합성한 임시음(약 0.12초). CC0 효과음을 찾으면 소리 부분만 고침 (시스템 기획서 사운드)
export function playStep(audio: AudioContext, when: number, from?: { right: number; front: number }) {
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.12), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  // 높은 소리를 걸러 모래를 밟는 둔한 소리로
  const low = new BiquadFilterNode(audio, { type: 'lowpass', frequency: 350 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.4, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
  const thump = new OscillatorNode(audio, { frequency: 110 })
  thump.frequency.setValueAtTime(110, when)
  thump.frequency.exponentialRampToValueAtTime(50, when + 0.1)
  const thumpVolume = new GainNode(audio)
  thumpVolume.gain.setValueAtTime(0.35, when)
  thumpVolume.gain.exponentialRampToValueAtTime(0.001, when + 0.1)
  const out = new GainNode(audio)
  source.connect(low).connect(volume).connect(out)
  thump.connect(thumpVolume).connect(out)
  place(audio, out, from)
  source.start(when)
  thump.start(when)
  thump.stop(when + 0.1)
}

// 빨려 들어가는 소리를 when(AudioContext 시각, 초)부터 seconds 동안 냄 (사용자 결정 2026-11-11, SHEEP-145).
// 잡음이 낮은 데서 높은 데로 쓸려 올라가며 커지다 뚝 끊김. ponytail: 합성한 임시음. 들어 보고 CC0 효과음으로 바꿀지 정함
export function playWhoosh(audio: AudioContext, when: number, seconds: number) {
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * seconds), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  const band = new BiquadFilterNode(audio, { type: 'bandpass', frequency: 200, Q: 1.2 })
  band.frequency.setValueAtTime(200, when)
  band.frequency.exponentialRampToValueAtTime(3000, when + seconds)
  const volume = new GainNode(audio, { gain: 0 })
  volume.gain.setValueAtTime(0.001, when)
  volume.gain.exponentialRampToValueAtTime(0.6, when + seconds * 0.95)
  volume.gain.linearRampToValueAtTime(0, when + seconds)
  source.connect(band).connect(volume).connect(effectsOut(audio))
  source.start(when)
}

// 술집 스윙 도어를 미는 소리를 when(AudioContext 시각, 초)에 냄 (사용자 플레이테스트 2026-11-11, SHEEP-153).
// 나무 문짝이 쾅 밀리는 둔한 소리에, 문짝이 앞뒤로 떠는 동안(entrance.ts swingAngle, 주기 0.63초) 경첩이 두 번 삐걱임.
// ponytail: 합성한 임시음. 들어 보고 CC0 효과음으로 바꿀지 정함 (시스템 기획서 사운드)
export function playDoor(audio: AudioContext, when: number) {
  const out = new GainNode(audio)
  out.connect(effectsOut(audio))
  // 쾅: 나무 판이 울리는 낮은 잡음과 둔탁한 두드림
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.25), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  const wood = new BiquadFilterNode(audio, { type: 'bandpass', frequency: 260, Q: 2 })
  const bang = new GainNode(audio)
  bang.gain.setValueAtTime(0.9, when)
  bang.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
  source.connect(wood).connect(bang).connect(out)
  source.start(when)
  const knock = new OscillatorNode(audio, { type: 'triangle', frequency: 150 })
  knock.frequency.setValueAtTime(150, when)
  knock.frequency.exponentialRampToValueAtTime(70, when + 0.15)
  const knockVolume = new GainNode(audio)
  knockVolume.gain.setValueAtTime(0.5, when)
  knockVolume.gain.exponentialRampToValueAtTime(0.001, when + 0.15)
  knock.connect(knockVolume).connect(out)
  knock.start(when)
  knock.stop(when + 0.15)
  // 삐걱: 높낮이가 떨리는 톱니파를 좁은 대역으로 걸러 경첩 소리로. 떠는 문짝이 되돌아올 때마다 한 번씩, 점점 작게
  for (const [at, gain] of [
    [0.12, 0.12],
    [0.45, 0.06],
  ]) {
    const start = when + at
    const creak = new OscillatorNode(audio, { type: 'sawtooth', frequency: 620 })
    creak.frequency.setValueAtTime(620, start)
    creak.frequency.linearRampToValueAtTime(840, start + 0.22)
    const wobble = new OscillatorNode(audio, { frequency: 28 })
    const depth = new GainNode(audio, { gain: 40 })
    wobble.connect(depth).connect(creak.frequency)
    const hinge = new BiquadFilterNode(audio, { type: 'bandpass', frequency: 1400, Q: 6 })
    const volume = new GainNode(audio, { gain: 0 })
    volume.gain.setValueAtTime(0.001, start)
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.05)
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
    creak.connect(hinge).connect(volume).connect(out)
    for (const o of [creak, wobble]) {
      o.start(start)
      o.stop(start + 0.25)
    }
  }
}

// 판 끝 포스터에 Winner 도장이 쾅 찍히는 소리 (SHEEP-172). 나무 판에 댄 종이를 고무 도장으로 내려치는 낮은 쿵에, 종이가 눌리는 짧은 탁.
// ponytail: 합성한 임시음. 들어 보고 CC0 효과음으로 바꿀지 정함 (시스템 기획서 사운드)
export function playStamp(audio: AudioContext, when: number) {
  const out = effectsOut(audio)
  const thump = new OscillatorNode(audio, { type: 'sine', frequency: 110 })
  thump.frequency.setValueAtTime(110, when)
  thump.frequency.exponentialRampToValueAtTime(45, when + 0.2)
  const body = new GainNode(audio, { gain: 0 })
  body.gain.setValueAtTime(0.9, when)
  body.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
  thump.connect(body).connect(out)
  thump.start(when)
  thump.stop(when + 0.25)
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.06), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const slap = new AudioBufferSourceNode(audio, { buffer: noise })
  const paper = new BiquadFilterNode(audio, { type: 'lowpass', frequency: 1800 })
  const slapVolume = new GainNode(audio, { gain: 0 })
  slapVolume.gain.setValueAtTime(0.6, when)
  slapVolume.gain.exponentialRampToValueAtTime(0.001, when + 0.06)
  slap.connect(paper).connect(slapVolume).connect(out)
  slap.start(when)
}

// 단추를 누르는 소리를 when(AudioContext 시각, 초)에 냄 (시스템 기획서 사운드 클릭 소리, SHEEP-209 시안 A).
// 나무 판을 손가락 마디로 톡 두드림: 결이 있는 잡음을 1.7kHz 언저리로 걸러 짧게 줄이고, 낮게 떨어지는 판 울림을 더함
export function playClick(audio: AudioContext, when: number) {
  const out = effectsOut(audio)
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.06), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const grain = new AudioBufferSourceNode(audio, { buffer: noise })
  const wood = new BiquadFilterNode(audio, { type: 'bandpass', frequency: 1700, Q: 2.5 })
  const tap = new GainNode(audio, { gain: 0.0001 })
  tap.gain.exponentialRampToValueAtTime(0.5, when + 0.002)
  tap.gain.exponentialRampToValueAtTime(0.0001, when + 0.05)
  grain.connect(wood).connect(tap).connect(out)
  grain.start(when)
  const ring = new OscillatorNode(audio, { type: 'sine', frequency: 240 })
  ring.frequency.setValueAtTime(240, when)
  ring.frequency.exponentialRampToValueAtTime(140, when + 0.06)
  const body = new GainNode(audio, { gain: 0.0001 })
  body.gain.exponentialRampToValueAtTime(0.35, when + 0.002)
  body.gain.exponentialRampToValueAtTime(0.0001, when + 0.08)
  ring.connect(body).connect(out)
  ring.start(when)
  ring.stop(when + 0.1)
}

// 금속 종을 친 듯한 맑은 소리. 배음 몇 개를 같이 울려 짧게 줄임. gain은 크기, seconds는 줄어드는 시간
function bell(audio: AudioContext, when: number, partials: readonly number[], gain: number, seconds: number) {
  const out = effectsOut(audio)
  for (const [i, frequency] of partials.entries()) {
    const tone = new OscillatorNode(audio, { type: 'sine', frequency })
    const volume = new GainNode(audio, { gain: 0 })
    volume.gain.setValueAtTime(gain / (i + 1), when)
    volume.gain.exponentialRampToValueAtTime(0.001, when + seconds / (i + 1))
    tone.connect(volume).connect(out)
    tone.start(when)
    tone.stop(when + seconds)
  }
}

// 내 한 발로 마지막 사람을 쓰러뜨린 순간의 확인음 (SHEEP-187). 화면이 멈추는 때 맑게 한 번
export function playDing(audio: AudioContext, when: number) {
  bell(audio, when, [1318, 2637, 3951], 0.35, 0.9)
}

// 잔고가 $10 오를 때마다 내는 동전 소리 (SHEEP-187). 마지막 하나는 조금 크고 길게. 음원 파일 없이 만듦
export function playCoin(audio: AudioContext, when: number, last = false) {
  const pitch = 1 + (Math.random() - 0.5) * 0.08
  bell(audio, when, [2093 * pitch, 2794 * pitch], last ? 0.22 : 0.12, last ? 0.5 : 0.14)
}

// 탈락을 보여 주기 시작한 때부터 뒤로 넘어지는 동작이 바닥에 닿기까지(ms). 시간 초과와 나가기는 자살 모습(총을 댐, 불꽃)이 끝난 뒤에 넘어짐
export const fallDelay = (reason: DownReason) => (reason !== 'shot' ? SUICIDE_AIM + SUICIDE_FLASH : 0) + FALL_LAND_MS

// 쓰러지는 소리 한 번을 when(AudioContext 시각, 초)에 냄. 방향과 거리는 총소리와 같음.
// ponytail: 낮은 잡음으로 합성한 임시음(약 0.3초). CC0 효과음을 찾으면 소리 부분만 고침 (시스템 기획서 사운드)
// 예약한 소리 노드를 돌려줌. 판 끝에 마지막 쓰러짐을 느리게 보이면 아직 나지 않은 소리를 멈추고 다시 예약함 (SHEEP-169)
export function playFall(audio: AudioContext, when: number, from?: { right: number; front: number }): AudioScheduledSourceNode {
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.3), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  // 발소리보다 더 낮게 걸러 몸이 모래에 부딪히는 둔한 쿵으로
  const low = new BiquadFilterNode(audio, { type: 'lowpass', frequency: 180 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.8, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + 0.3)
  place(audio, source.connect(low).connect(volume), from)
  source.start(when)
  return source
}

// from이 있으면 그 자리에서 들리게(HRTF) 내보내고, 없으면 가운데서 들림
function place(audio: AudioContext, out: AudioNode, from?: { right: number; front: number }) {
  if (from) {
    const where = { positionX: from.right, positionY: 0, positionZ: -from.front }
    out = out.connect(new PannerNode(audio, { panningModel: 'HRTF', refDistance: 4, ...where }))
  }
  out.connect(effectsOut(audio))
}
