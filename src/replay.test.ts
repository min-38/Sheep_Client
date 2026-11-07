import { describe, expect, test } from 'vitest'
import type { Sample } from './interpolate.ts'
import { cut, REPLAY_AFTER, REPLAY_BEFORE, replayWindow } from './replay.ts'

const at = (t: number): Sample => ({ at: t, x: t / 100, y: 0, angle: 0, pitch: 0, pose: 'stand' })

describe('replayWindow', () => {
  test('쏜 시각 앞 REPLAY_BEFORE부터 내가 쓰러진 것을 받고 REPLAY_AFTER 뒤까지 (시스템 기획서 HUD 다시 보기)', () => {
    expect(REPLAY_BEFORE).toBe(3000)
    expect(REPLAY_AFTER).toBe(1000)
    expect(replayWindow(10000, 10300)).toEqual({ start: 7000, end: 11300 })
  })
})

describe('cut', () => {
  const samples = [0, 50, 100, 150, 200, 250].map(at)

  test('구간 안의 상태와 양쪽 바깥 하나씩을 남겨 끝에서도 보간함', () => {
    expect(cut(samples, 120, 170).map((s) => s.at)).toEqual([100, 150, 200])
  })

  test('구간 끝이 상태와 같으면 그 상태까지', () => {
    expect(cut(samples, 100, 200).map((s) => s.at)).toEqual([100, 150, 200])
  })

  test('쌓인 것보다 넓은 구간은 있는 것 모두', () => {
    expect(cut(samples, -500, 900).map((s) => s.at)).toEqual([0, 50, 100, 150, 200, 250])
  })

  test('원래 배열은 그대로 두고 새 배열을 돌려줌. 뒤에 쌓이는 상태가 떠 둔 기록에 섞이지 않음', () => {
    const kept = cut(samples, 0, 250)
    expect(kept).not.toBe(samples)
    expect(samples).toHaveLength(6)
  })
})
