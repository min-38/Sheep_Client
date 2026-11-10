import dustySaloonUrl from './assets/audio/dusty-saloon.mp3'
import highNoonStandoffUrl from './assets/audio/high-noon-standoff.mp3'
import lastOneStandingUrl from './assets/audio/last-one-standing.mp3'
import quickestHandUrl from './assets/audio/quickest-hand-in-town.mp3'
import { STEPS_FROM, WALK_DURATION, type Schedule } from './round.ts'

// 배경음악 (시스템 기획서 사운드 배경음악). 사용자가 Suno로 만든 곡이고 출처는 CREDITS.md.
// ponytail: 화면마다 곡은 임시로 고름. 들어 보고 사용자가 정함
// victory는 승리 결과 동안 한 번만 트는 승리 곡(9.88초, SHEEP-150)이고 나머지는 되풀이함
const TRACKS = { title: lastOneStandingUrl, saloon: dustySaloonUrl, standoff: highNoonStandoffUrl, victory: quickestHandUrl }
export type Track = keyof typeof TRACKS
// 지금 보이는 화면. 첫 화면, 술집 대기실, 결투장
export type Screen = 'title' | 'saloon' | 'arena'

// ms. 곡을 바꿀 때 줄이거나 키우는 시간. ponytail: 임시 값(시스템 기획서 사운드)
export const MUSIC_FADE = 300

// ms. 10걸음을 다 걸은 뒤 결투 전 곡을 천천히 줄여 끄는 시간 (사용자 결정 2026-11-10, SHEEP-141).
// "시작!"까지 기다리는 시간(0.1~10초)보다 길 수 있어 결투 첫머리에 작게 남기도 함. ponytail: 임시 값. 들어 보고 정함
export const MUSIC_STOP_FADE = 3000

// now(서버 시계)에 틀 곡. 결투장에서는 카운트다운부터 10걸음을 다 걸을 때까지만 틀고, 그 뒤로 결투와 판 결과 동안은
// 총소리와 발소리만 남게 조용함(null) (사용자 결정 2026-11-10, SHEEP-141). won은 승리 결과를 받아 보이는 중인지이고,
// 그동안은 판 끝 포스터부터 받은 돈 자막까지 승리 곡을 끝까지 틂. 이긴 사람, 진 사람, 관전자 모두 같이 들음 (SHEEP-150)
export function trackAt(screen: Screen, s: Schedule, now: number, won = false): Track | null {
  if (screen !== 'arena') return screen
  if (won) return 'victory'
  return s.walk !== undefined && now >= s.walk + STEPS_FROM + WALK_DURATION ? null : 'standoff'
}

// 모든 곡이 지나는 크기 조절 하나. 설정의 배경음악 크기를 여기에만 걸고, 효과음과 따로라 음악을 꺼도 총소리는 들림
let volume = 1
let bus: GainNode | null = null
// 곡마다 <audio> 하나. 1분이 넘는 곡을 decodeAudioData로 다 풀면 곡마다 수십 MB라, 요소로 흘려 읽어 GainNode에 이음
const players = new Map<Track, { element: HTMLAudioElement; gain: GainNode }>()
let playing: Track | null = null

// 배경음악 크기(0~1). AudioContext를 만들기 전에 불러도 만들 때 이 값을 씀
export function setMusicVolume(v: number) {
  volume = v
  if (bus) bus.gain.value = v
}

// 곡을 바꿈. 앞 곡은 MUSIC_FADE 동안 줄인 뒤 멈추고, 새 곡은 처음부터 키움. 같은 곡이면 그대로 둠.
// 끄기(null)는 MUSIC_STOP_FADE 동안 천천히 줄임. fadeMs를 주면 줄이고 키우는 시간을 그 값으로 함(술집을 나서는 동안, SHEEP-145).
// ponytail: mp3는 앞뒤에 짧은 무음이 붙어 되풀이할 때 틈이 날 수 있음. 거슬리면 끝에서 다음 곡 처음으로 겹쳐 넘김
export function playMusic(audio: AudioContext, track: Track | null, fadeMs = track === null ? MUSIC_STOP_FADE : MUSIC_FADE) {
  if (track === playing) return
  const now = audio.currentTime
  const fade = fadeMs / 1000
  const old = playing === null ? undefined : players.get(playing)
  if (old) {
    const stopping = playing
    old.gain.gain.cancelScheduledValues(now)
    old.gain.gain.setValueAtTime(old.gain.gain.value, now)
    old.gain.gain.linearRampToValueAtTime(0, now + fade)
    // 그사이 같은 곡으로 돌아왔으면 멈추지 않음
    setTimeout(() => playing !== stopping && old.element.pause(), fadeMs)
  }
  playing = track
  if (track === null) return
  const next = player(audio, track)
  next.gain.gain.cancelScheduledValues(now)
  next.gain.gain.setValueAtTime(0, now)
  next.gain.gain.linearRampToValueAtTime(1, now + fade)
  next.element.currentTime = 0
  // 사용자 입력 뒤에 만든 AudioContext라 막히지 않음. 그래도 막히면 그 곡은 조용하고 다음 곡에서 다시 해 봄
  next.element.play().catch(() => {})
}

function player(audio: AudioContext, track: Track) {
  let p = players.get(track)
  if (!p) {
    if (bus?.context !== audio) {
      bus = new GainNode(audio, { gain: volume })
      bus.connect(audio.destination)
    }
    const element = new Audio(TRACKS[track])
    element.loop = track !== 'victory'
    const gain = new GainNode(audio, { gain: 0 })
    new MediaElementAudioSourceNode(audio, { mediaElement: element }).connect(gain).connect(bus)
    p = { element, gain }
    players.set(track, p)
  }
  return p
}
