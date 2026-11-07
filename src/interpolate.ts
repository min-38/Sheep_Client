import type { PlayerState } from './net.ts'

const TAU = Math.PI * 2
// 한 사람마다 쌓아 두는 상태 수. 20Hz면 400ms어치라 100ms 전을 그리기에 넉넉함
const KEEP = 8

// 받은 시각(ms, performance.now())과 그때의 위치, 각도, 동작
export type Sample = { at: number; x: number; y: number; angle: number; pose: PlayerState['pose'] }

// state를 받을 때마다 부름. state에서 빠진 사람은 지움
export function record(history: Map<string, Sample[]>, players: readonly PlayerState[], at: number) {
  const ids = new Set(players.map((p) => p.id))
  for (const id of history.keys()) if (!ids.has(id)) history.delete(id)
  for (const { id, x, y, angle, pose } of players) {
    const samples = history.get(id) ?? []
    samples.push({ at, x, y, angle, pose })
    if (samples.length > KEEP) samples.shift()
    history.set(id, samples)
  }
}

// t 시각의 위치와 각도를 앞뒤 두 상태 사이에서 구함. 동작은 섞을 수 없어 t까지 마지막으로 받은 상태의 것. t가 쌓인 범위 밖이면 가까운 끝 상태 그대로 (앞질러 짐작하지 않음)
export function sampleAt(samples: readonly Sample[], t: number): Sample {
  const i = samples.findIndex((s) => s.at > t)
  if (i === -1) return samples[samples.length - 1]
  if (i === 0) return samples[0]
  const a = samples[i - 1]
  const b = samples[i]
  const f = (t - a.at) / (b.at - a.at)
  // 각도 차이를 -π~π로 묶어 짧은 쪽으로 돎. 결과는 0~2π 밖일 수 있으나 frameIndex가 8방향으로 묶음
  let d = (b.angle - a.angle) % TAU
  if (d > Math.PI) d -= TAU
  else if (d < -Math.PI) d += TAU
  return { at: t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: a.angle + d * f, pose: a.pose }
}
