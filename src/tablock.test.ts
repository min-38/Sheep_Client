import { describe, expect, test } from 'vitest'
import { oneTab } from './tablock.ts'

// navigator.locks.request(name, { ifAvailable: true }, callback)만 흉내 냄. 잡혀 있으면 callback에 null을 줌
function fakeLocks(held: boolean) {
  const calls: { name: string; ifAvailable?: boolean; kept?: Promise<unknown> }[] = []
  const locks = {
    request(name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => unknown) {
      const call: (typeof calls)[number] = { name, ifAvailable: options.ifAvailable }
      calls.push(call)
      const result = callback(held ? null : {})
      call.kept = result instanceof Promise ? result : undefined
      return Promise.resolve()
    },
  }
  return { locks: locks as unknown as LockManager, calls }
}

describe('oneTab', () => {
  test('잠금이 비어 있으면 접속하고, 탭이 살아 있는 동안 잠금을 쥠', async () => {
    const { locks, calls } = fakeLocks(false)
    const done: string[] = []
    oneTab(locks, () => done.push('connect'), () => done.push('blocked'))
    expect(done).toEqual(['connect'])
    expect(calls[0].ifAvailable).toBe(true)
    // 잠금을 쥔 약속이 끝나면 다른 탭이 들어오므로 끝나지 않아야 함
    const settled = await Promise.race([calls[0].kept!.then(() => true), Promise.resolve(false)])
    expect(settled).toBe(false)
  })

  test('다른 탭이 잠금을 쥐고 있으면 접속하지 않고 막힘을 알림', () => {
    const { locks } = fakeLocks(true)
    const done: string[] = []
    oneTab(locks, () => done.push('connect'), () => done.push('blocked'))
    expect(done).toEqual(['blocked'])
  })

  // 개발 빌드나 HTTP로 연 페이지처럼 잠금이 없으면 막지 않음
  test('잠금 기능이 없으면 그냥 접속함', () => {
    const done: string[] = []
    oneTab(undefined, () => done.push('connect'), () => done.push('blocked'))
    expect(done).toEqual(['connect'])
  })
})
