import type { Sample } from './interpolate.ts'

// ms. 다시 보기 길이. 쏜 시각(시간 초과면 제한 시각) 앞 REPLAY_BEFORE부터 내가 쓰러진 것을 받고 REPLAY_AFTER 뒤까지.
// REPLAY_AFTER는 뒤로 넘어지는 동작(바닥에 닿기까지 약 1초, 자리 잡기까지 약 1.5초)이 끝나고 누운 모습이 잠깐 보이는 길이.
// ponytail: 임시 값(시스템 기획서 HUD 다시 보기). 플레이해 보며 정함
export const REPLAY_BEFORE = 3000
export const REPLAY_AFTER = 2000

// 다시 볼 구간(ms, 내 시계). shotAt은 쓰러뜨린 발사의 쏜 시각을 내 시계로 바꾼 값, downAt은 내 탈락을 받은 시각.
// 기록은 받은 시각으로 쌓여 쏜 시각보다 조금 늦지만, 앞뒤로 넉넉히 잡아 그 발사와 내가 쓰러지는 것이 다 들어옴
export const replayWindow = (shotAt: number, downAt: number) => ({ start: shotAt - REPLAY_BEFORE, end: downAt + REPLAY_AFTER })

// 한 사람의 쌓인 상태에서 [start, end]를 그리는 데 드는 것만 새 배열로 떠 둠. 양 끝 바깥 하나씩을 남겨 끝에서도 보간함
export function cut(samples: readonly Sample[], start: number, end: number): Sample[] {
  const first = Math.max(0, samples.findLastIndex((s) => s.at <= start))
  const after = samples.findIndex((s) => s.at >= end)
  return samples.slice(first, after === -1 ? samples.length : after + 1)
}
