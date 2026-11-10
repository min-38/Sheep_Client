import { describe, expect, test } from 'vitest'
import { toServerTime } from './clock.ts'
import { en } from './i18n/en.ts'
import { banner, DUEL_LIMIT, dueling, formatTime, GO_SHOWN, joins, locked, resultText, standingCount, STEP_MS, STEPS, stepIndex, timeLeft, TURN_MS, WALK_DURATION, walking, type Schedule } from './round.ts'

// 서버가 알리는 순서: 카운트다운 시각, 카운트다운이 시작할 때 걷기 시각, 걷기가 시작할 때 결투 시각 (기술 설계서 메시지 phase)
const full: Schedule = { countdown: 10000, walk: 13000, duel: 16000 }

describe('banner', () => {
  test('카운트다운 시각 전에는 아무것도 띄우지 않음', () => {
    expect(banner({}, 10000)).toBe('')
    expect(banner({ countdown: 10000 }, 9999)).toBe('')
  })

  test('카운트다운부터 걷기 시각까지 3, 2, 1을 같은 간격으로 띄움', () => {
    expect(banner(full, 10000)).toBe('3')
    expect(banner(full, 10999)).toBe('3')
    expect(banner(full, 11000)).toBe('2')
    expect(banner(full, 12000)).toBe('1')
    expect(banner(full, 12999)).toBe('1')
  })

  test('간격은 걷기 시각으로 정해짐', () => {
    const s = { countdown: 10000, walk: 11500 }
    expect(banner(s, 10499)).toBe('3')
    expect(banner(s, 10500)).toBe('2')
    expect(banner(s, 11000)).toBe('1')
  })

  test('걷기 시각을 받기 전에는 3', () => {
    expect(banner({ countdown: 10000 }, 10500)).toBe('3')
  })

  test('걷는 동안은 아무것도 띄우지 않음', () => {
    expect(banner(full, 13000)).toBe('')
    expect(banner(full, 15999)).toBe('')
    // 결투 시각을 받기 전
    expect(banner({ countdown: 10000, walk: 13000 }, 20000)).toBe('')
  })

  test('결투 시각에 "시작!"을 띄우고 GO_SHOWN 뒤 지움', () => {
    expect(banner(full, 16000)).toBe(en.hud.go)
    expect(banner(full, 16000 + GO_SHOWN - 1)).toBe(en.hud.go)
    expect(banner(full, 16000 + GO_SHOWN)).toBe('')
  })

  test('서버가 알린 시각을 내 시계로 바꾼 그 순간에 띄움', () => {
    // 서버 시계가 4000ms 앞섬. 서버 16000은 내 12000
    expect(banner(full, toServerTime(11999, 4000))).toBe('')
    expect(banner(full, toServerTime(12000, 4000))).toBe(en.hud.go)
    // 서버 시계가 500ms 뒤처짐. 서버 16000은 내 16500
    expect(banner(full, toServerTime(16499, -500))).toBe('')
    expect(banner(full, toServerTime(16500, -500))).toBe(en.hud.go)
  })
})

describe('locked', () => {
  test('판 전에는 돌 수 있음', () => {
    expect(locked({}, 0)).toBe(false)
    expect(locked({ countdown: 10000 }, 9999)).toBe(false)
  })

  test('카운트다운과 걷기 동안은 막음', () => {
    for (const t of [10000, 12999, 13000, 15999]) expect(locked(full, t)).toBe(true)
  })

  test('결투 시각을 받기 전에는 계속 막음', () => {
    expect(locked({ countdown: 10000 }, 30000)).toBe(true)
    expect(locked({ countdown: 10000, walk: 13000 }, 30000)).toBe(true)
  })

  test('"시작!" 순간 풂', () => {
    expect(locked(full, 16000)).toBe(false)
    expect(locked(full, 99999)).toBe(false)
  })
})

describe('dueling', () => {
  test('"시작!" 전에는 쏠 수 없음', () => {
    expect(dueling({}, 99999)).toBe(false)
    expect(dueling({ countdown: 10000, walk: 13000 }, 99999)).toBe(false)
    expect(dueling(full, 15999)).toBe(false)
  })

  test('"시작!" 순간부터 쏠 수 있음', () => {
    expect(dueling(full, 16000)).toBe(true)
    expect(dueling(full, 99999)).toBe(true)
  })
})

describe('resultText', () => {
  test('이긴 사람에게는 승리, 나머지에게는 패배', () => {
    const win = { outcome: 'win' as const, playerIds: ['p1'], rounds: 0 }
    expect(resultText(win, 'p1')).toBe(en.hud.win)
    expect(resultText(win, 'p2')).toBe(en.hud.lose)
  })

  test('재대결은 재대결하는 사람 수를 보여 줌', () => {
    expect(resultText({ outcome: 'rematch', playerIds: ['p1', 'p2'], rounds: 2 }, 'p1')).toBe(en.hud.rematch(2))
    // 재대결에 끼지 못한 사람도 같은 글자를 봄
    expect(resultText({ outcome: 'rematch', playerIds: ['p1', 'p2', 'p3'], rounds: 3 }, 'p4')).toBe(en.hud.rematch(3))
  })
})

describe('timeLeft', () => {
  test('결투 시각 전에는 없음', () => {
    expect(timeLeft({}, 500)).toBeNull()
    expect(timeLeft({ duel: 1000 }, 500)).toBeNull()
  })

  test('결투 시각부터 제한 시간을 셈', () => {
    expect(timeLeft({ duel: 1000 }, 1000)).toBe(DUEL_LIMIT)
    expect(timeLeft({ duel: 1000 }, 4000)).toBe(DUEL_LIMIT - 3000)
  })

  test('제한 시각이 지나면 0', () => {
    expect(timeLeft({ duel: 1000 }, 1000 + DUEL_LIMIT)).toBe(0)
    expect(timeLeft({ duel: 1000 }, 12000)).toBe(0)
  })
})

describe('formatTime', () => {
  test('초를 올림해 분:초로 씀', () => {
    expect(formatTime(7000)).toBe('0:07')
    expect(formatTime(6001)).toBe('0:07')
    expect(formatTime(10000)).toBe('0:10')
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(61000)).toBe('1:01')
  })
})

describe('walking', () => {
  test('걷기 시각 전과 뒤도는 동안은 걷지 않음 (SHEEP-120)', () => {
    expect(walking({}, 99999)).toBe(false)
    expect(walking(full, 12999)).toBe(false)
    expect(walking(full, 13000)).toBe(false)
    expect(walking(full, 13000 + TURN_MS - 1)).toBe(false)
  })

  test('다 돌고 나서 걷는 시간 동안 걸음', () => {
    expect(walking(full, 13000 + TURN_MS)).toBe(true)
    expect(walking(full, 13000 + TURN_MS + WALK_DURATION - 1)).toBe(true)
  })

  test('걷는 시간이 지나면 걷지 않음. 결투 시각을 기다리는 동안도', () => {
    expect(walking(full, 13000 + TURN_MS + WALK_DURATION)).toBe(false)
    expect(walking({ countdown: 10000, walk: 13000 }, 13000 + TURN_MS + WALK_DURATION + 500)).toBe(false)
  })
})

describe('stepIndex', () => {
  test('다 돈 뒤부터 STEP_MS마다 한 걸음, 모두 10걸음 (사용자 결정 2026-11-10, SHEEP-120)', () => {
    expect(STEPS).toBe(10)
    expect(WALK_DURATION).toBe(STEPS * STEP_MS)
    expect(stepIndex(1000, 1000 + TURN_MS)).toBe(0)
    expect(stepIndex(1000, 1000 + TURN_MS + STEP_MS - 1)).toBe(0)
    expect(stepIndex(1000, 1000 + TURN_MS + STEP_MS)).toBe(1)
    expect(stepIndex(1000, 1000 + TURN_MS + WALK_DURATION - 1)).toBe(STEPS - 1)
  })
})

describe('joins', () => {
  test('앞 결과가 없으면 준비한 사람 모두 낌', () => {
    expect(joins(null, 'a')).toBe(true)
  })

  test('재대결이면 결과의 playerIds만 낌', () => {
    const r = { outcome: 'rematch' as const, playerIds: ['a', 'b'], rounds: 1 }
    expect(joins(r, 'a')).toBe(true)
    expect(joins(r, 'c')).toBe(false)
  })

  // 창이 숨어 그리기가 멈추면 앞 판의 승리 결과가 끝나지 않은 채 새 판 카운트다운이 옴
  test('승리로 끝난 앞 판 뒤의 새 판은 모두 낌', () => {
    expect(joins({ outcome: 'win', playerIds: ['b'], rounds: 0 }, 'a')).toBe(true)
  })
})

describe('standingCount', () => {
  const ids = ['a', 'b', 'c']

  test('아무도 쓰러지지 않았으면 모두', () => {
    expect(standingCount(ids, new Map(), 5000)).toBe(3)
  })

  test('쓰러진 시각부터 빼고 그 전에는 셈', () => {
    const downs = new Map([['b', { at: 5000 }]])
    expect(standingCount(ids, downs, 4999)).toBe(3)
    expect(standingCount(ids, downs, 5000)).toBe(2)
  })

  test('앞 라운드에 쓰러져 재대결에 끼지 못한 사람도 뺌', () => {
    const downs = new Map([['a', { at: 1000 }], ['c', { at: 9000 }]])
    expect(standingCount(ids, downs, 9500)).toBe(1)
  })
})
