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
