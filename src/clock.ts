// 시계 맞추기 한 번의 결과(ms). offset은 서버 시각 - 내 시각. 왕복이 짧을수록 offset이 정확함
export type ClockSample = { roundTrip: number; offset: number }

// t0: 보낸 내 시각, ts: 서버 시각, t1: 받은 내 시각. 가는 지연과 오는 지연이 같다고 보고 ts를 그 중간에 맞춤 (기술 설계서 시간 맞추기)
export const measure = (t0: number, ts: number, t1: number): ClockSample => ({ roundTrip: t1 - t0, offset: ts - (t0 + t1) / 2 })

// 지연이 한쪽으로 치우친 오차는 왕복의 절반을 넘지 않으므로, 왕복이 가장 짧은 값을 씀
export const best = (samples: readonly ClockSample[]) => samples.reduce((a, b) => (b.roundTrip < a.roundTrip ? b : a))

export const toServerTime = (local: number, offset: number) => local + offset
export const toLocalTime = (server: number, offset: number) => server - offset
