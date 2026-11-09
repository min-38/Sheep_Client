import { describe, expect, test } from 'vitest'
import { moveActive } from './dropdown.ts'

describe('moveActive', () => {
  test.each([
    ['ArrowDown', 2, 3],
    ['ArrowUp', 2, 1],
    ['Home', 4, 0],
    ['End', 1, 6],
  ])('%s는 %i번에서 %i번으로', (key, active, next) => {
    expect(moveActive(key, active, 7)).toBe(next)
  })

  // 끝에서 더 가면 돌지 않고 그 자리에 둠 (브라우저 select와 같음)
  test('끝에서 ↓, 처음에서 ↑는 그대로', () => {
    expect(moveActive('ArrowDown', 6, 7)).toBe(6)
    expect(moveActive('ArrowUp', 0, 7)).toBe(0)
  })

  test.each(['Enter', 'Escape', 'Tab', 'a'])('목록을 옮기지 않는 키 %s는 null', (key) => {
    expect(moveActive(key, 3, 7)).toBeNull()
  })
})
