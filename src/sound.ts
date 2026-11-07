import closeCylinderUrl from './assets/audio/close-cylinder.mp3'
import cockHammerUrl from './assets/audio/cock-hammer.mp3'
import dryFireUrl from './assets/audio/dry-fire.mp3'
import loadUrl from './assets/audio/load.mp3'
import shotUrl from './assets/audio/shot.mp3'

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

// 초. "시작!" 신호음 길이. 공이치기 소리를 이 뒤에 냄
export const SIGNAL_SECONDS = 0.3

// "시작!" 신호음을 when(AudioContext 시각, 초)에 울림. 0.3초 넘게 늦으면 소리가 다 줄어든 뒤라 들리지 않음.
// ponytail: Web Audio로 합성한 임시음. CC0 효과음으로 바꿀 때 이 함수만 고침 (기술 설계서 사운드 구현)
export function playSignal(audio: AudioContext, when: number) {
  const tone = new OscillatorNode(audio, { frequency: 880 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.3, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + SIGNAL_SECONDS)
  tone.connect(volume).connect(audio.destination)
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

// 효과음을 when(AudioContext 시각, 초)에 냄. from이 있으면 그 자리에서 들리고(HRTF), 없으면 내 소리라 가운데서 들림.
// 듣는 사람(AudioListener)은 기본값 그대로 원점에서 -z를 보므로 오른쪽이 +x, 앞이 -z임.
// 4칸(걷기를 마친 자리의 반지름) 안에서는 같은 크기, 더 멀면 거리에 반비례해 줄어듦.
// 소리 길이(초)를 돌려줌. 아직 풀지 못해 건너뛰면 0
export function play(audio: AudioContext, name: Effect, when: number, from?: { right: number; front: number }) {
  const buffer = buffers[name]
  if (!buffer) return 0
  const source = new AudioBufferSourceNode(audio, { buffer })
  place(audio, source.connect(new GainNode(audio, { gain: VOLUME[name] })), from)
  source.start(when)
  return buffer.duration
}

// 장전 소리. 총알을 넣고 이어서 실린더를 닫음
export function playReload(audio: AudioContext, when: number) {
  play(audio, 'closeCylinder', when + play(audio, 'load', when))
}

// 발소리 한 걸음을 when(AudioContext 시각, 초)에 냄. 방향과 거리는 총소리와 같음.
// ponytail: 낮은 잡음으로 합성한 임시음(약 0.06초). CC0 효과음을 찾으면 소리 부분만 고침 (시스템 기획서 사운드)
export function playStep(audio: AudioContext, when: number, from?: { right: number; front: number }) {
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.06), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  // 높은 소리를 걸러 모래를 밟는 둔한 소리로
  const low = new BiquadFilterNode(audio, { type: 'lowpass', frequency: 500 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.3, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + 0.06)
  place(audio, source.connect(low).connect(volume), from)
  source.start(when)
}

// from이 있으면 그 자리에서 들리게(HRTF) 내보내고, 없으면 가운데서 들림
function place(audio: AudioContext, out: AudioNode, from?: { right: number; front: number }) {
  if (from) {
    const where = { positionX: from.right, positionY: 0, positionZ: -from.front }
    out = out.connect(new PannerNode(audio, { panningModel: 'HRTF', refDistance: 4, ...where }))
  }
  out.connect(audio.destination)
}
