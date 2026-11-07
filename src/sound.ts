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

// "시작!" 신호음을 when(AudioContext 시각, 초)에 울림. 0.3초 넘게 늦으면 소리가 다 줄어든 뒤라 들리지 않음.
// ponytail: Web Audio로 합성한 임시음. CC0 효과음으로 바꿀 때 이 함수만 고침 (기술 설계서 사운드 구현)
export function playSignal(audio: AudioContext, when: number) {
  const tone = new OscillatorNode(audio, { frequency: 880 })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.3, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + 0.3)
  tone.connect(volume).connect(audio.destination)
  tone.start(when)
  tone.stop(when + 0.3)
}

// 쏜 사람 자리(칸)를 내 시선 기준으로 바꿈. right는 화면 오른쪽(카메라 평면 쪽), front는 시선 쪽 거리(칸)
export function heardFrom(viewX: number, viewY: number, angle: number, x: number, y: number) {
  const dx = x - viewX
  const dy = y - viewY
  return { right: Math.cos(angle) * dy - Math.sin(angle) * dx, front: Math.cos(angle) * dx + Math.sin(angle) * dy }
}

// 총소리를 when(AudioContext 시각, 초)에 냄. from이 있으면 그 자리에서 들리고(HRTF), 없으면 내 총이라 가운데서 들림.
// 듣는 사람(AudioListener)은 기본값 그대로 원점에서 -z를 보므로 오른쪽이 +x, 앞이 -z임.
// 4칸(걷기를 마친 자리의 반지름) 안에서는 같은 크기, 더 멀면 거리에 반비례해 줄어듦.
// ponytail: 흰 소음으로 합성한 임시음. CC0 효과음으로 바꿀 때 소리 부분만 고침 (기술 설계서 사운드 구현)
export function playShot(audio: AudioContext, when: number, from?: { right: number; front: number }) {
  const noise = new AudioBuffer({ length: Math.round(audio.sampleRate * 0.25), sampleRate: audio.sampleRate })
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = new AudioBufferSourceNode(audio, { buffer: noise })
  const volume = new GainNode(audio)
  volume.gain.setValueAtTime(0.5, when)
  volume.gain.exponentialRampToValueAtTime(0.001, when + 0.25)
  place(audio, source.connect(volume), from)
  source.start(when)
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
